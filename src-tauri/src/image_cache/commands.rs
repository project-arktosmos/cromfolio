use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::State;

use super::cache::{
    build_cache_path, calculate_stats, clear_cache as clear_cache_impl, fetch_and_save, is_cached,
    path_to_asset_url, ImageCacheState,
};
use super::models::{
    BackgroundDownloadProgress, BackgroundDownloadStatus, BatchCacheProgress, CacheImageResult,
    CacheStats,
};

/// Check if a URL is cached, return the local path if so
#[tauri::command]
pub fn get_cached_image(
    state: State<'_, ImageCacheState>,
    url: String,
) -> Result<Option<String>, String> {
    match is_cached(&state.cache_dir, &url) {
        Some(path) => Ok(Some(path_to_asset_url(&path))),
        None => Ok(None),
    }
}

/// Cache a single image, return the local path
#[tauri::command]
pub fn cache_image(
    state: State<'_, ImageCacheState>,
    url: String,
) -> Result<CacheImageResult, String> {
    // Check if already cached
    if let Some(path) = is_cached(&state.cache_dir, &url) {
        return Ok(CacheImageResult::success(path_to_asset_url(&path)));
    }

    // Check if already being fetched
    {
        let mut in_flight = state.in_flight.lock().map_err(|e| e.to_string())?;
        if in_flight.contains(&url) {
            // Wait a bit and check again
            drop(in_flight);
            std::thread::sleep(std::time::Duration::from_millis(100));

            // Re-check cache
            if let Some(path) = is_cached(&state.cache_dir, &url) {
                return Ok(CacheImageResult::success(path_to_asset_url(&path)));
            }

            return Ok(CacheImageResult::error(
                "Image is being fetched by another request".to_string(),
            ));
        }
        in_flight.insert(url.clone());
    }

    // Fetch and cache
    let result = fetch_and_save(&url, &state.cache_dir);

    // Remove from in-flight
    {
        let mut in_flight = state.in_flight.lock().map_err(|e| e.to_string())?;
        in_flight.remove(&url);
    }

    match result {
        Ok(cached) => Ok(CacheImageResult::success(path_to_asset_url(
            std::path::Path::new(&cached.local_path),
        ))),
        Err(e) => Ok(CacheImageResult::error(e)),
    }
}

/// Cache multiple images at once
#[tauri::command]
pub fn cache_images_batch(
    state: State<'_, ImageCacheState>,
    urls: Vec<String>,
) -> Result<BatchCacheProgress, String> {
    let mut progress = BatchCacheProgress::new(urls.len());

    for url in urls {
        // Check if already cached
        if is_cached(&state.cache_dir, &url).is_some() {
            progress.completed += 1;
            progress.skipped += 1;
            continue;
        }

        // Check and mark as in-flight
        let should_fetch = {
            let mut in_flight = state.in_flight.lock().map_err(|e| e.to_string())?;
            if in_flight.contains(&url) {
                false
            } else {
                in_flight.insert(url.clone());
                true
            }
        };

        if !should_fetch {
            progress.completed += 1;
            progress.skipped += 1;
            continue;
        }

        // Fetch and cache
        let result = fetch_and_save(&url, &state.cache_dir);

        // Remove from in-flight
        {
            let mut in_flight = state.in_flight.lock().map_err(|e| e.to_string())?;
            in_flight.remove(&url);
        }

        match result {
            Ok(_) => {
                progress.completed += 1;
                progress.cached += 1;
            }
            Err(e) => {
                progress.completed += 1;
                progress.errors.push(format!("{}: {}", url, e));
            }
        }
    }

    Ok(progress)
}

/// Get cache statistics
#[tauri::command]
pub fn get_cache_stats(state: State<'_, ImageCacheState>) -> Result<CacheStats, String> {
    Ok(calculate_stats(&state.cache_dir))
}

/// Clear the image cache
#[tauri::command]
pub fn clear_image_cache(
    state: State<'_, ImageCacheState>,
    source: Option<String>,
) -> Result<usize, String> {
    clear_cache_impl(&state.cache_dir, source.as_deref())
}

/// Get the local cache path for a URL (without fetching)
#[tauri::command]
pub fn get_cache_path(state: State<'_, ImageCacheState>, url: String) -> String {
    let path = build_cache_path(&state.cache_dir, &url);
    path_to_asset_url(&path)
}

// ============================================================================
// BACKGROUND DOWNLOAD COMMANDS
// ============================================================================

/// Start a background download job for a collection's images
#[tauri::command]
pub fn start_background_download(
    state: State<'_, ImageCacheState>,
    urls: Vec<String>,
    collection_id: String,
    collection_title: String,
) -> Result<bool, String> {
    // Check if already running
    {
        let progress = state.background_progress.lock().map_err(|e| e.to_string())?;
        if progress.status == BackgroundDownloadStatus::Running {
            return Err("A background download is already in progress".to_string());
        }
    }

    // Reset cancel flag
    state.cancel_flag.store(false, Ordering::SeqCst);

    // Initialize progress
    {
        let mut progress = state.background_progress.lock().map_err(|e| e.to_string())?;
        *progress = BackgroundDownloadProgress {
            status: BackgroundDownloadStatus::Running,
            collection_id: Some(collection_id.clone()),
            collection_title: Some(collection_title.clone()),
            total: urls.len(),
            completed: 0,
            cached: 0,
            skipped: 0,
            failed: 0,
            current_url: None,
            errors: Vec::new(),
            started_at: Some(chrono::Utc::now().timestamp_millis()),
            finished_at: None,
        };
    }

    // Clone necessary data for the background thread
    let cache_dir = state.cache_dir.clone();
    let progress_arc = Arc::clone(&state.background_progress);
    let cancel_flag = Arc::clone(&state.cancel_flag);

    // Spawn background thread
    thread::spawn(move || {
        run_background_download(urls, cache_dir, progress_arc, cancel_flag);
    });

    Ok(true)
}

/// Background download worker function
fn run_background_download(
    urls: Vec<String>,
    cache_dir: PathBuf,
    progress_arc: Arc<Mutex<BackgroundDownloadProgress>>,
    cancel_flag: Arc<std::sync::atomic::AtomicBool>,
) {
    for url in urls {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.status = BackgroundDownloadStatus::Cancelled;
                progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
                progress.current_url = None;
            }
            return;
        }

        // Update current URL
        if let Ok(mut progress) = progress_arc.lock() {
            progress.current_url = Some(url.clone());
        }

        // Check if already cached
        if is_cached(&cache_dir, &url).is_some() {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.completed += 1;
                progress.skipped += 1;
            }
            continue;
        }

        // Fetch and cache
        match fetch_and_save(&url, &cache_dir) {
            Ok(_) => {
                if let Ok(mut progress) = progress_arc.lock() {
                    progress.completed += 1;
                    progress.cached += 1;
                }
            }
            Err(e) => {
                if let Ok(mut progress) = progress_arc.lock() {
                    progress.completed += 1;
                    progress.failed += 1;
                    if progress.errors.len() < 50 {
                        // Limit error count
                        progress.errors.push(format!("{}: {}", url, e));
                    }
                }
            }
        }

        // Small delay to avoid overwhelming the server
        thread::sleep(std::time::Duration::from_millis(100));
    }

    // Mark as completed
    if let Ok(mut progress) = progress_arc.lock() {
        if progress.status == BackgroundDownloadStatus::Running {
            progress.status = BackgroundDownloadStatus::Completed;
        }
        progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
        progress.current_url = None;
    }
}

/// Get the current progress of the background download
#[tauri::command]
pub fn get_background_download_progress(
    state: State<'_, ImageCacheState>,
) -> Result<BackgroundDownloadProgress, String> {
    let progress = state.background_progress.lock().map_err(|e| e.to_string())?;
    Ok(progress.clone())
}

/// Cancel the current background download
#[tauri::command]
pub fn cancel_background_download(state: State<'_, ImageCacheState>) -> Result<bool, String> {
    // Set cancel flag
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(true)
}

/// Reset the background download state to idle
#[tauri::command]
pub fn reset_background_download(state: State<'_, ImageCacheState>) -> Result<bool, String> {
    let mut progress = state.background_progress.lock().map_err(|e| e.to_string())?;

    // Only reset if not running
    if progress.status == BackgroundDownloadStatus::Running {
        return Err("Cannot reset while download is in progress".to_string());
    }

    *progress = BackgroundDownloadProgress::default();
    state.cancel_flag.store(false, Ordering::SeqCst);
    Ok(true)
}
