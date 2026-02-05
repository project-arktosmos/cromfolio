use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{command, AppHandle, Manager, State};
use zip::ZipArchive;

use crate::db::{queries, Database};
use crate::models::{Stamp, StampPack};

use super::types::*;

/// State for tracking WhatsApp imports
pub struct WhatsappImportState {
    pub progress: Arc<Mutex<WhatsappImportProgress>>,
    pub cancel_flag: Arc<AtomicBool>,
}

impl WhatsappImportState {
    pub fn new() -> Self {
        Self {
            progress: Arc::new(Mutex::new(WhatsappImportProgress::default())),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for WhatsappImportState {
    fn default() -> Self {
        Self::new()
    }
}

/// Start importing WhatsApp sticker packs from file paths (runs in background)
#[command]
pub fn start_whatsapp_import(
    state: State<'_, WhatsappImportState>,
    db: State<'_, Database>,
    app: AppHandle,
    file_paths: Vec<String>,
) -> Result<String, String> {
    if file_paths.is_empty() {
        return Err("No files provided".to_string());
    }

    // Check if already running
    {
        let progress = state.progress.lock().map_err(|e| e.to_string())?;
        if progress.status == WhatsappImportStatus::Running {
            return Err("An import is already in progress".to_string());
        }
    }

    // Generate task ID
    let task_id = uuid::Uuid::new_v4().to_string();

    // Reset cancel flag
    state.cancel_flag.store(false, Ordering::SeqCst);

    // Initialize progress
    {
        let mut progress = state.progress.lock().map_err(|e| e.to_string())?;
        *progress = WhatsappImportProgress {
            status: WhatsappImportStatus::Running,
            task_id: Some(task_id.clone()),
            file_path: file_paths.first().cloned(),
            pack_name: None,
            total_files: file_paths.len(),
            processed_files: 0,
            total_stickers: 0,
            processed_stickers: 0,
            errors: Vec::new(),
            started_at: Some(chrono::Utc::now().timestamp_millis()),
            finished_at: None,
            result_pack_ids: Vec::new(),
        };
    }

    // Clone necessary data for background thread
    let progress_arc = Arc::clone(&state.progress);
    let cancel_flag = Arc::clone(&state.cancel_flag);
    let db_conn = Arc::clone(&db.conn);
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Spawn background thread
    thread::spawn(move || {
        run_whatsapp_import(file_paths, data_dir, db_conn, progress_arc, cancel_flag);
    });

    Ok(task_id)
}

/// Background import worker
fn run_whatsapp_import(
    file_paths: Vec<String>,
    data_dir: PathBuf,
    db_conn: Arc<Mutex<rusqlite::Connection>>,
    progress_arc: Arc<Mutex<WhatsappImportProgress>>,
    cancel_flag: Arc<AtomicBool>,
) {
    let mut result_pack_ids: Vec<i64> = Vec::new();

    for file_path in &file_paths {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.status = WhatsappImportStatus::Cancelled;
                progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
            }
            return;
        }

        // Update current file
        if let Ok(mut progress) = progress_arc.lock() {
            progress.file_path = Some(file_path.clone());
        }

        match import_single_wastickers_file(
            file_path,
            &data_dir,
            &db_conn,
            &progress_arc,
            &cancel_flag,
        ) {
            Ok(pack_id) => {
                result_pack_ids.push(pack_id);
            }
            Err(e) => {
                if let Ok(mut progress) = progress_arc.lock() {
                    if progress.errors.len() < 50 {
                        progress.errors.push(format!("{}: {}", file_path, e));
                    }
                }
            }
        }

        // Update processed files count
        if let Ok(mut progress) = progress_arc.lock() {
            progress.processed_files += 1;
        }
    }

    // Update final status
    if let Ok(mut progress) = progress_arc.lock() {
        if progress.status == WhatsappImportStatus::Running {
            if result_pack_ids.is_empty() {
                progress.status = WhatsappImportStatus::Failed;
                if progress.errors.is_empty() {
                    progress.errors.push("No packs could be imported".to_string());
                }
            } else {
                progress.status = WhatsappImportStatus::Completed;
            }
        }
        progress.result_pack_ids = result_pack_ids;
        progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
    }
}

/// Import a single .wastickers file
fn import_single_wastickers_file(
    file_path: &str,
    data_dir: &PathBuf,
    db_conn: &Arc<Mutex<rusqlite::Connection>>,
    progress_arc: &Arc<Mutex<WhatsappImportProgress>>,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<i64, String> {
    // Read the file
    let file_data =
        std::fs::read(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Open as ZIP archive
    let cursor = std::io::Cursor::new(&file_data);
    let mut archive =
        ZipArchive::new(cursor).map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

    // Extract metadata and stickers
    let mut title = String::from("Unknown Pack");
    let mut author = String::from("Unknown Author");
    let mut tray_image_data: Option<Vec<u8>> = None;
    let mut tray_filename = String::new();
    let mut sticker_files: Vec<(String, Vec<u8>)> = Vec::new();

    for i in 0..archive.len() {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Import cancelled".to_string());
        }

        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        if file.is_dir() {
            continue;
        }

        let name = file
            .name()
            .to_string()
            .trim_start_matches('/')
            .to_string();

        if name == "title.txt" {
            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| format!("Failed to read title.txt: {}", e))?;
            title = content.trim().to_string();
        } else if name == "author.txt" {
            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| format!("Failed to read author.txt: {}", e))?;
            author = content.trim().to_string();
        } else if name.ends_with(".png") {
            let mut data = Vec::new();
            file.read_to_end(&mut data)
                .map_err(|e| format!("Failed to read tray image: {}", e))?;
            tray_image_data = Some(data);
            tray_filename = name;
        } else if name.ends_with(".webp") {
            let mut data = Vec::new();
            file.read_to_end(&mut data)
                .map_err(|e| format!("Failed to read sticker: {}", e))?;
            sticker_files.push((name, data));
        }
    }

    // Update progress with pack info
    if let Ok(mut progress) = progress_arc.lock() {
        progress.pack_name = Some(title.clone());
        progress.total_stickers += sticker_files.len();
    }

    if sticker_files.is_empty() {
        return Err("No stickers found in pack".to_string());
    }

    // Generate directory ID (UUID for file storage path)
    let dir_id = uuid::Uuid::new_v4().to_string();
    let stamps_dir = data_dir.join("stamps").join(&dir_id);

    // Create stamps directory
    std::fs::create_dir_all(&stamps_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // Write tray image if present
    let tray_image_path = if let Some(tray_data) = tray_image_data {
        let path = stamps_dir.join(&tray_filename);
        std::fs::write(&path, &tray_data)
            .map_err(|e| format!("Failed to write tray image: {}", e))?;
        Some(format!("{}/{}", dir_id, tray_filename))
    } else {
        None
    };

    // Write original pack file
    let original_filename = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("pack.wastickers");
    let pack_file_path = stamps_dir.join(original_filename);
    std::fs::write(&pack_file_path, &file_data)
        .map_err(|e| format!("Failed to write pack file: {}", e))?;
    let pack_file_relative = format!("{}/{}", dir_id, original_filename);

    // Write sticker files and track them (just image_path now, id will be auto-generated)
    let mut sticker_paths: Vec<String> = Vec::new();

    for (filename, data) in &sticker_files {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            // Clean up on cancellation
            let _ = std::fs::remove_dir_all(&stamps_dir);
            return Err("Import cancelled".to_string());
        }

        let sticker_path = stamps_dir.join(filename);
        if let Err(e) = std::fs::write(&sticker_path, data) {
            if let Ok(mut progress) = progress_arc.lock() {
                if progress.errors.len() < 50 {
                    progress.errors.push(format!("{}: {}", filename, e));
                }
            }
            continue;
        }

        let image_path = format!("{}/{}", dir_id, filename);
        sticker_paths.push(image_path);

        if let Ok(mut progress) = progress_arc.lock() {
            progress.processed_stickers += 1;
        }
    }

    if sticker_paths.is_empty() {
        // Clean up if no stickers were saved
        let _ = std::fs::remove_dir_all(&stamps_dir);
        return Err("Failed to save any stickers".to_string());
    }

    // Create database records
    let now = chrono::Utc::now().to_rfc3339();

    let db_result = (|| -> Result<i64, String> {
        let conn = db_conn.lock().map_err(|e| e.to_string())?;

        // Create stamp pack (id: 0 means database will auto-generate)
        let stamp_pack = StampPack {
            id: 0,
            source: "whatsapp".to_string(),
            name: title,
            author,
            tray_image: tray_image_path,
            pack_file: Some(pack_file_relative),
            sticker_count: sticker_paths.len() as i32,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        let created_pack = queries::stamp_packs::create(&conn, &stamp_pack)?;
        let pack_id = created_pack.id;

        // Create stamps (id: 0 means database will auto-generate)
        let stamps: Vec<Stamp> = sticker_paths
            .iter()
            .map(|image_path| Stamp {
                id: 0,
                pack_id,
                image_path: image_path.clone(),
                emojis: None,
                created_at: now.clone(),
            })
            .collect();

        queries::stamps::create_batch(&conn, &stamps)?;

        Ok(pack_id)
    })();

    match db_result {
        Ok(pack_id) => Ok(pack_id),
        Err(e) => {
            // Clean up files on DB failure
            let _ = std::fs::remove_dir_all(&stamps_dir);
            Err(format!("Database error: {}", e))
        }
    }
}

/// Get current import progress
#[command]
pub fn get_whatsapp_import_progress(
    state: State<'_, WhatsappImportState>,
) -> Result<WhatsappImportProgress, String> {
    let progress = state.progress.lock().map_err(|e| e.to_string())?;
    Ok(progress.clone())
}

/// Cancel current import
#[command]
pub fn cancel_whatsapp_import(state: State<'_, WhatsappImportState>) -> Result<bool, String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(true)
}

/// Reset import state to idle
#[command]
pub fn reset_whatsapp_import(state: State<'_, WhatsappImportState>) -> Result<bool, String> {
    let mut progress = state.progress.lock().map_err(|e| e.to_string())?;

    if progress.status == WhatsappImportStatus::Running {
        return Err("Cannot reset while import is in progress".to_string());
    }

    *progress = WhatsappImportProgress::default();
    state.cancel_flag.store(false, Ordering::SeqCst);
    Ok(true)
}
