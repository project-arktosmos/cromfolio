use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a cached image entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedImage {
    pub url_hash: String,
    pub original_url: String,
    pub local_path: String,
    pub source: String,
    pub cached_at: i64,
    pub file_size: u64,
}

/// Result of a cache operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheImageResult {
    pub success: bool,
    pub local_path: Option<String>,
    pub error: Option<String>,
}

impl CacheImageResult {
    pub fn success(local_path: String) -> Self {
        Self {
            success: true,
            local_path: Some(local_path),
            error: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            local_path: None,
            error: Some(message),
        }
    }
}

/// Progress of batch caching operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCacheProgress {
    pub total: usize,
    pub completed: usize,
    pub cached: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

impl BatchCacheProgress {
    pub fn new(total: usize) -> Self {
        Self {
            total,
            completed: 0,
            cached: 0,
            skipped: 0,
            errors: Vec::new(),
        }
    }
}

/// Statistics for a single source (domain)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SourceStats {
    pub count: usize,
    pub size_bytes: u64,
}

/// Overall cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_images: usize,
    pub total_size_bytes: u64,
    pub by_source: HashMap<String, SourceStats>,
}

impl Default for CacheStats {
    fn default() -> Self {
        Self {
            total_images: 0,
            total_size_bytes: 0,
            by_source: HashMap::new(),
        }
    }
}

/// Status of a background download job
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundDownloadStatus {
    Idle,
    Running,
    Completed,
    Cancelled,
    Failed,
}

/// Progress of a background download job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundDownloadProgress {
    pub status: BackgroundDownloadStatus,
    pub collection_id: Option<String>,
    pub collection_title: Option<String>,
    pub total: usize,
    pub completed: usize,
    pub cached: usize,
    pub skipped: usize,
    pub failed: usize,
    pub current_url: Option<String>,
    pub errors: Vec<String>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
}

impl Default for BackgroundDownloadProgress {
    fn default() -> Self {
        Self {
            status: BackgroundDownloadStatus::Idle,
            collection_id: None,
            collection_title: None,
            total: 0,
            completed: 0,
            cached: 0,
            skipped: 0,
            failed: 0,
            current_url: None,
            errors: Vec::new(),
            started_at: None,
            finished_at: None,
        }
    }
}
