use serde::{Deserialize, Serialize};

/// Telegram API response wrapper
#[derive(Debug, Deserialize)]
pub struct TelegramResponse<T> {
    pub ok: bool,
    pub description: Option<String>,
    pub result: Option<T>,
}

/// Telegram sticker set
#[derive(Debug, Deserialize)]
pub struct TelegramStickerSet {
    pub name: String,
    pub title: String,
    pub stickers: Vec<TelegramSticker>,
}

/// Individual Telegram sticker
#[derive(Debug, Deserialize)]
pub struct TelegramSticker {
    pub file_id: String,
    pub file_unique_id: String,
    pub is_animated: bool,
    pub is_video: bool,
    pub emoji: Option<String>,
}

/// Telegram file info
#[derive(Debug, Deserialize)]
pub struct TelegramFile {
    pub file_id: String,
    pub file_unique_id: String,
    pub file_path: Option<String>,
}

/// Import status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TelegramImportStatus {
    Idle,
    Running,
    Completed,
    Cancelled,
    Failed,
}

/// Import progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramImportProgress {
    pub status: TelegramImportStatus,
    pub task_id: Option<String>,
    pub pack_name: Option<String>,
    pub pack_title: Option<String>,
    pub total: usize,
    pub completed: usize,
    pub downloaded: usize,
    pub failed: usize,
    pub current_sticker: Option<String>,
    pub errors: Vec<String>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub result_pack_id: Option<i64>,
}

impl Default for TelegramImportProgress {
    fn default() -> Self {
        Self {
            status: TelegramImportStatus::Idle,
            task_id: None,
            pack_name: None,
            pack_title: None,
            total: 0,
            completed: 0,
            downloaded: 0,
            failed: 0,
            current_sticker: None,
            errors: Vec::new(),
            started_at: None,
            finished_at: None,
            result_pack_id: None,
        }
    }
}
