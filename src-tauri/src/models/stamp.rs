use serde::{Deserialize, Serialize};

/// Individual stamp entity within a stamp pack
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Stamp {
    #[serde(default)]
    pub id: String,
    /// Reference to the stamp pack this stamp belongs to
    #[serde(default)]
    pub pack_id: String,
    /// Path to the sticker image (relative to app data dir)
    #[serde(default)]
    pub image_path: String,
    /// Associated emojis (JSON array stored as string)
    #[serde(default)]
    pub emojis: Option<String>,
    /// Timestamp
    #[serde(default)]
    pub created_at: String,
}
