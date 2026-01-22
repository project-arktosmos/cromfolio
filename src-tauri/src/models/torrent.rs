use serde::{Deserialize, Serialize};

/// Torrent status for database persistence
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TorrentDbStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Error,
}

impl Default for TorrentDbStatus {
    fn default() -> Self {
        TorrentDbStatus::Pending
    }
}

impl std::fmt::Display for TorrentDbStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TorrentDbStatus::Pending => write!(f, "pending"),
            TorrentDbStatus::Downloading => write!(f, "downloading"),
            TorrentDbStatus::Paused => write!(f, "paused"),
            TorrentDbStatus::Completed => write!(f, "completed"),
            TorrentDbStatus::Error => write!(f, "error"),
        }
    }
}

impl TorrentDbStatus {
    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => TorrentDbStatus::Pending,
            "downloading" => TorrentDbStatus::Downloading,
            "paused" => TorrentDbStatus::Paused,
            "completed" => TorrentDbStatus::Completed,
            "error" => TorrentDbStatus::Error,
            _ => TorrentDbStatus::Pending,
        }
    }
}

/// Torrent entity for database persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Torrent {
    #[serde(default)]
    pub id: String,
    pub info_hash: String,
    pub name: String,
    pub source: String,
    pub download_dir: String,
    #[serde(default)]
    pub total_bytes: i64,
    #[serde(default)]
    pub downloaded_bytes: i64,
    #[serde(default)]
    pub status: TorrentDbStatus,
    pub error_message: Option<String>,
    pub added_at: String,
    pub completed_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// Torrent file entity for database persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentFile {
    #[serde(default)]
    pub id: String,
    pub torrent_id: String,
    pub file_index: i32,
    pub path: String,
    pub size: i64,
    #[serde(default)]
    pub created_at: String,
}
