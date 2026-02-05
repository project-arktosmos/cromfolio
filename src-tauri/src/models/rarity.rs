use serde::{Deserialize, Serialize};

/// Rarity entity for defining card rarity levels with gradient colors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rarity {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub name: String,
    /// First color of the gradient (hex format, e.g., "#FF5733")
    #[serde(default)]
    pub color_from: String,
    /// Second color of the gradient (hex format, e.g., "#33FF57")
    #[serde(default)]
    pub color_to: String,
    /// Sort order for display (lower = more common)
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
