use serde::{Deserialize, Serialize};

/// User-owned sticker entity - tracks which stickers a user owns
/// Stored in the _user_stickers table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSticker {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub sticker_id: i64,
    #[serde(default)]
    pub source_id: i64,

    // Which collection this sticker was earned from
    #[serde(default)]
    pub collection_id: Option<i64>,

    // Rarity of the sticker at time of acquisition
    #[serde(default)]
    pub rarity_id: Option<i64>,

    // Timestamp when the sticker was acquired
    #[serde(default)]
    pub acquired_at: String,
}
