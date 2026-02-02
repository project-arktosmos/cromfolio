use serde::{Deserialize, Serialize};

/// User-placed icon entity - tracks SVG icons placed on album pages
/// Stored in the _user_placed_icons table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserPlacedIcon {
    #[serde(default)]
    pub id: String,
    /// Path to the SVG icon (e.g., /stamp/lorc/sword.svg)
    #[serde(default)]
    pub icon_path: String,
    #[serde(default)]
    pub collection_id: String,
    #[serde(default)]
    pub page_index: i32,
    /// X position as percentage (0-100)
    #[serde(default)]
    pub position_x: f64,
    /// Y position as percentage (0-100)
    #[serde(default)]
    pub position_y: f64,
    /// Scale factor (0.25 - 3.0)
    #[serde(default = "default_scale")]
    pub scale: f64,
    /// Rotation in degrees (-180 to 180)
    #[serde(default)]
    pub rotation: f64,
    /// Hex color (e.g., #000000)
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub placed_at: String,
}

fn default_scale() -> f64 {
    1.0
}

fn default_color() -> String {
    "#000000".to_string()
}
