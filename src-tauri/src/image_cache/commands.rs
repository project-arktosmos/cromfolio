use tauri::State;

use super::cache::{
    build_cache_path, calculate_stats, clear_cache as clear_cache_impl, fetch_and_save, is_cached,
    path_to_asset_url, ImageCacheState,
};
use super::models::{BatchCacheProgress, CacheImageResult, CacheStats};

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
