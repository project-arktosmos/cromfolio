use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{command, AppHandle, Manager, State};

use crate::db::{queries, Database};
use crate::models::{Stamp, StampPack};

use super::client::TelegramClient;
use super::types::*;

/// State for tracking Telegram imports
pub struct TelegramImportState {
    pub progress: Arc<Mutex<TelegramImportProgress>>,
    pub cancel_flag: Arc<AtomicBool>,
}

impl TelegramImportState {
    pub fn new() -> Self {
        Self {
            progress: Arc::new(Mutex::new(TelegramImportProgress::default())),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for TelegramImportState {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse pack name from URL or direct name
fn parse_pack_name(input: &str) -> Option<String> {
    let trimmed = input.trim();

    // Try to match URL pattern
    if let Ok(re) = regex::Regex::new(r"(?:https?://)?t\.me/addstickers/([a-zA-Z0-9_]+)") {
        if let Some(caps) = re.captures(trimmed) {
            return caps.get(1).map(|m| m.as_str().to_string());
        }
    }

    // Check if it's a direct pack name
    if let Ok(re) = regex::Regex::new(r"^[a-zA-Z0-9_]+$") {
        if re.is_match(trimmed) {
            return Some(trimmed.to_string());
        }
    }

    None
}

/// Determine file extension based on sticker type
fn get_sticker_extension(sticker: &TelegramSticker) -> &'static str {
    if sticker.is_animated {
        ".tgs"
    } else if sticker.is_video {
        ".webm"
    } else {
        ".webp"
    }
}

/// Start importing a Telegram sticker pack (runs in background)
#[command]
pub fn start_telegram_import(
    state: State<'_, TelegramImportState>,
    db: State<'_, Database>,
    app: AppHandle,
    pack_name_or_url: String,
) -> Result<String, String> {
    // Parse pack name
    let pack_name =
        parse_pack_name(&pack_name_or_url).ok_or_else(|| "Invalid pack name or URL".to_string())?;

    // Check if already running
    {
        let progress = state.progress.lock().map_err(|e| e.to_string())?;
        if progress.status == TelegramImportStatus::Running {
            return Err("An import is already in progress".to_string());
        }
    }

    // Get bot token from environment
    let bot_token = std::env::var("PUBLIC_TELEGRAM_BOT_TOKEN")
        .or_else(|_| std::env::var("TELEGRAM_BOT_TOKEN"))
        .map_err(|_| "Telegram bot token not configured".to_string())?;

    // Generate task ID
    let task_id = uuid::Uuid::new_v4().to_string();

    // Reset cancel flag
    state.cancel_flag.store(false, Ordering::SeqCst);

    // Initialize progress
    {
        let mut progress = state.progress.lock().map_err(|e| e.to_string())?;
        *progress = TelegramImportProgress {
            status: TelegramImportStatus::Running,
            task_id: Some(task_id.clone()),
            pack_name: Some(pack_name.clone()),
            pack_title: None,
            total: 0,
            completed: 0,
            downloaded: 0,
            failed: 0,
            current_sticker: None,
            errors: Vec::new(),
            started_at: Some(chrono::Utc::now().timestamp_millis()),
            finished_at: None,
            result_pack_id: None,
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
        run_telegram_import(
            pack_name,
            bot_token,
            data_dir,
            db_conn,
            progress_arc,
            cancel_flag,
        );
    });

    Ok(task_id)
}

/// Background import worker
fn run_telegram_import(
    pack_name: String,
    bot_token: String,
    data_dir: PathBuf,
    db_conn: Arc<Mutex<rusqlite::Connection>>,
    progress_arc: Arc<Mutex<TelegramImportProgress>>,
    cancel_flag: Arc<AtomicBool>,
) {
    // Create Telegram client
    let client = match TelegramClient::new(bot_token) {
        Ok(c) => c,
        Err(e) => {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.status = TelegramImportStatus::Failed;
                progress.errors.push(e);
                progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
            }
            return;
        }
    };

    // Fetch sticker set
    let sticker_set = match client.get_sticker_set(&pack_name) {
        Ok(s) => s,
        Err(e) => {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.status = TelegramImportStatus::Failed;
                progress.errors.push(format!("Failed to fetch sticker set: {}", e));
                progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
            }
            return;
        }
    };

    // Update progress with pack info
    if let Ok(mut progress) = progress_arc.lock() {
        progress.pack_title = Some(sticker_set.title.clone());
        progress.total = sticker_set.stickers.len();
    }

    // Generate pack ID
    let pack_id = uuid::Uuid::new_v4().to_string();
    let stamps_dir = data_dir.join("stamps").join(&pack_id);

    // Create stamps directory
    if let Err(e) = std::fs::create_dir_all(&stamps_dir) {
        if let Ok(mut progress) = progress_arc.lock() {
            progress.status = TelegramImportStatus::Failed;
            progress.errors.push(format!("Failed to create directory: {}", e));
            progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
        }
        return;
    }

    // Download stickers
    let mut downloaded_stickers: Vec<(String, String, Option<String>)> = Vec::new();

    for sticker in &sticker_set.stickers {
        // Check for cancellation
        if cancel_flag.load(Ordering::SeqCst) {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.status = TelegramImportStatus::Cancelled;
                progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
            }
            // Clean up partial download
            let _ = std::fs::remove_dir_all(&stamps_dir);
            return;
        }

        // Update current sticker
        if let Ok(mut progress) = progress_arc.lock() {
            progress.current_sticker = Some(sticker.file_unique_id.clone());
        }

        // Get file info
        let file_info = match client.get_file(&sticker.file_id) {
            Ok(f) => f,
            Err(e) => {
                if let Ok(mut progress) = progress_arc.lock() {
                    progress.completed += 1;
                    progress.failed += 1;
                    if progress.errors.len() < 50 {
                        progress
                            .errors
                            .push(format!("{}: {}", sticker.file_unique_id, e));
                    }
                }
                continue;
            }
        };

        // Download file
        let file_path = match file_info.file_path {
            Some(p) => p,
            None => {
                if let Ok(mut progress) = progress_arc.lock() {
                    progress.completed += 1;
                    progress.failed += 1;
                }
                continue;
            }
        };

        let file_data = match client.download_file(&file_path) {
            Ok(d) => d,
            Err(e) => {
                if let Ok(mut progress) = progress_arc.lock() {
                    progress.completed += 1;
                    progress.failed += 1;
                    if progress.errors.len() < 50 {
                        progress
                            .errors
                            .push(format!("{}: {}", sticker.file_unique_id, e));
                    }
                }
                continue;
            }
        };

        // Determine filename
        let ext = get_sticker_extension(sticker);
        let filename = format!("{}{}", sticker.file_unique_id, ext);
        let local_path = stamps_dir.join(&filename);

        // Save file
        if let Err(e) = std::fs::write(&local_path, &file_data) {
            if let Ok(mut progress) = progress_arc.lock() {
                progress.completed += 1;
                progress.failed += 1;
                if progress.errors.len() < 50 {
                    progress
                        .errors
                        .push(format!("{}: {}", sticker.file_unique_id, e));
                }
            }
            continue;
        }

        // Track success
        let image_path = format!("{}/{}", pack_id, filename);
        downloaded_stickers.push((
            uuid::Uuid::new_v4().to_string(),
            image_path,
            sticker.emoji.clone(),
        ));

        if let Ok(mut progress) = progress_arc.lock() {
            progress.completed += 1;
            progress.downloaded += 1;
        }

        // Small delay to avoid rate limiting
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    // Check if we have any stickers
    if downloaded_stickers.is_empty() {
        if let Ok(mut progress) = progress_arc.lock() {
            progress.status = TelegramImportStatus::Failed;
            progress
                .errors
                .push("No stickers could be downloaded".to_string());
            progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
        }
        let _ = std::fs::remove_dir_all(&stamps_dir);
        return;
    }

    // Create database records
    let now = chrono::Utc::now().to_rfc3339();

    // Lock database and create records
    let db_result = (|| -> Result<(), String> {
        let conn = db_conn.lock().map_err(|e| e.to_string())?;

        // Create stamp pack
        let stamp_pack = StampPack {
            id: pack_id.clone(),
            source: "telegram".to_string(),
            name: sticker_set.title.clone(),
            author: pack_name.clone(),
            tray_image: None,
            pack_file: None,
            sticker_count: downloaded_stickers.len() as i32,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        queries::stamp_packs::create(&conn, &stamp_pack)?;

        // Create stamps
        let stamps: Vec<Stamp> = downloaded_stickers
            .iter()
            .map(|(id, image_path, emoji)| Stamp {
                id: id.clone(),
                pack_id: pack_id.clone(),
                image_path: image_path.clone(),
                emojis: emoji.clone(),
                created_at: now.clone(),
            })
            .collect();

        queries::stamps::create_batch(&conn, &stamps)?;

        Ok(())
    })();

    // Update final status
    if let Ok(mut progress) = progress_arc.lock() {
        match db_result {
            Ok(()) => {
                progress.status = TelegramImportStatus::Completed;
                progress.result_pack_id = Some(pack_id);
            }
            Err(e) => {
                progress.status = TelegramImportStatus::Failed;
                progress.errors.push(format!("Database error: {}", e));
                // Clean up files on DB failure
                let _ = std::fs::remove_dir_all(&stamps_dir);
            }
        }
        progress.current_sticker = None;
        progress.finished_at = Some(chrono::Utc::now().timestamp_millis());
    }
}

/// Get current import progress
#[command]
pub fn get_telegram_import_progress(
    state: State<'_, TelegramImportState>,
) -> Result<TelegramImportProgress, String> {
    let progress = state.progress.lock().map_err(|e| e.to_string())?;
    Ok(progress.clone())
}

/// Cancel current import
#[command]
pub fn cancel_telegram_import(state: State<'_, TelegramImportState>) -> Result<bool, String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(true)
}

/// Reset import state to idle
#[command]
pub fn reset_telegram_import(state: State<'_, TelegramImportState>) -> Result<bool, String> {
    let mut progress = state.progress.lock().map_err(|e| e.to_string())?;

    if progress.status == TelegramImportStatus::Running {
        return Err("Cannot reset while import is in progress".to_string());
    }

    *progress = TelegramImportProgress::default();
    state.cancel_flag.store(false, Ordering::SeqCst);
    Ok(true)
}
