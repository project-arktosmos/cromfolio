use serde::{Deserialize, Serialize};

/// Import status enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WhatsappImportStatus {
    Idle,
    Running,
    Completed,
    Cancelled,
    Failed,
}

/// Import progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsappImportProgress {
    pub status: WhatsappImportStatus,
    pub task_id: Option<String>,
    pub file_path: Option<String>,
    pub pack_name: Option<String>,
    pub total_files: usize,
    pub processed_files: usize,
    pub total_stickers: usize,
    pub processed_stickers: usize,
    pub errors: Vec<String>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub result_pack_ids: Vec<i64>,
}

impl Default for WhatsappImportProgress {
    fn default() -> Self {
        Self {
            status: WhatsappImportStatus::Idle,
            task_id: None,
            file_path: None,
            pack_name: None,
            total_files: 0,
            processed_files: 0,
            total_stickers: 0,
            processed_stickers: 0,
            errors: Vec::new(),
            started_at: None,
            finished_at: None,
            result_pack_ids: Vec::new(),
        }
    }
}
