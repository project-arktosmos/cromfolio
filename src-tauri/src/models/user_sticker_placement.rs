use serde::{Deserialize, Serialize};

/// User sticker placement entity - tracks which stickers are "stuck" in albums
/// Stored in the _user_sticker_placements table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserStickerPlacement {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub sticker_id: String,
    #[serde(default)]
    pub collection_id: String,
    #[serde(default)]
    pub placed_at: String,
}
