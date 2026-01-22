use serde::{Deserialize, Serialize};

/// Status of a torrent download
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TorrentStatus {
    Pending,
    Initializing,
    Checking,
    Downloading,
    Seeding,
    Paused,
    Completed,
    Error,
}

impl Default for TorrentStatus {
    fn default() -> Self {
        TorrentStatus::Pending
    }
}

impl std::fmt::Display for TorrentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TorrentStatus::Pending => write!(f, "pending"),
            TorrentStatus::Initializing => write!(f, "initializing"),
            TorrentStatus::Checking => write!(f, "checking"),
            TorrentStatus::Downloading => write!(f, "downloading"),
            TorrentStatus::Seeding => write!(f, "seeding"),
            TorrentStatus::Paused => write!(f, "paused"),
            TorrentStatus::Completed => write!(f, "completed"),
            TorrentStatus::Error => write!(f, "error"),
        }
    }
}

impl TorrentStatus {
    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => TorrentStatus::Pending,
            "initializing" => TorrentStatus::Initializing,
            "checking" => TorrentStatus::Checking,
            "downloading" => TorrentStatus::Downloading,
            "seeding" => TorrentStatus::Seeding,
            "paused" => TorrentStatus::Paused,
            "completed" => TorrentStatus::Completed,
            "error" => TorrentStatus::Error,
            _ => TorrentStatus::Pending,
        }
    }
}

/// Progress event emitted to the frontend during downloads
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentProgressEvent {
    pub torrent_id: String,
    pub info_hash: String,
    pub name: String,
    pub status: TorrentStatus,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub peers_connected: u32,
    pub seeds_connected: u32,
    pub eta_seconds: Option<u64>,
    pub message: Option<String>,
}

/// Event emitted when a torrent is successfully added
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentAddedEvent {
    pub torrent_id: String,
    pub info_hash: String,
    pub name: String,
    pub total_bytes: u64,
    pub files: Vec<TorrentFileInfo>,
}

/// Information about a file within a torrent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentFileInfo {
    pub index: usize,
    pub path: String,
    pub size: u64,
}

/// Full torrent information returned from list/get commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentInfo {
    pub id: String,
    pub info_hash: String,
    pub name: String,
    pub source: String,
    pub download_dir: String,
    pub status: TorrentStatus,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub peers_connected: u32,
    pub seeds_connected: u32,
    pub eta_seconds: Option<u64>,
    pub error_message: Option<String>,
    pub files: Vec<TorrentFileInfo>,
    pub added_at: String,
    pub completed_at: Option<String>,
}
