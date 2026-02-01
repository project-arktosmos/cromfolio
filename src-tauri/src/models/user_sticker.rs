use serde::{Deserialize, Serialize};

/// User-owned sticker entity - tracks which stickers a user owns
/// Stored in the _user_stickers table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSticker {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub sticker_id: String,
    #[serde(default)]
    pub source_id: String,

    // Timestamp when the sticker was acquired
    #[serde(default)]
    pub acquired_at: String,
}
