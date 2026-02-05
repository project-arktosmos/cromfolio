use serde::{Deserialize, Serialize};

/// User-placed stamp entity - tracks stamps placed on album pages
/// Stored in the _user_placed_stamps table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserPlacedStamp {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub stamp_id: i64,
    #[serde(default)]
    pub collection_id: i64,
    #[serde(default)]
    pub page_index: i32,
    #[serde(default)]
    pub position_x: f64,
    #[serde(default)]
    pub position_y: f64,
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default)]
    pub placed_at: String,
}

fn default_scale() -> f64 {
    1.0
}
