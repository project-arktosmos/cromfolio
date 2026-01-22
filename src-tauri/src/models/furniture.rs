use serde::{Deserialize, Serialize};

/// Furniture type enum for categorizing furniture items
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FurnitureType {
    Shelf,
    Table,
    Door,
    Window,
    Carpet,
    Decoration,
}

impl Default for FurnitureType {
    fn default() -> Self {
        FurnitureType::Decoration
    }
}

impl std::fmt::Display for FurnitureType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FurnitureType::Shelf => write!(f, "shelf"),
            FurnitureType::Table => write!(f, "table"),
            FurnitureType::Door => write!(f, "door"),
            FurnitureType::Window => write!(f, "window"),
            FurnitureType::Carpet => write!(f, "carpet"),
            FurnitureType::Decoration => write!(f, "decoration"),
        }
    }
}

impl FurnitureType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "shelf" => FurnitureType::Shelf,
            "table" => FurnitureType::Table,
            "door" => FurnitureType::Door,
            "window" => FurnitureType::Window,
            "carpet" => FurnitureType::Carpet,
            "decoration" => FurnitureType::Decoration,
            _ => FurnitureType::Decoration,
        }
    }
}

/// Furniture entity for 3D models used in the game room
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Furniture {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub furniture_type: FurnitureType,
    /// Path to the 3D model file (relative to /static/model/)
    #[serde(default)]
    pub model_path: String,
    /// Scale factor for displaying the model (default 1.0)
    #[serde(default = "default_scale")]
    pub scale: f64,
    /// Optional thumbnail image for preview
    #[serde(default)]
    pub thumbnail: Option<String>,
    /// Optional description
    #[serde(default)]
    pub description: Option<String>,
    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_scale() -> f64 {
    1.0
}
