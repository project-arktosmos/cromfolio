use serde::{Deserialize, Serialize};

/// StickerTypeEntity for defining sticker types stored in the database (formerly BlueprintTypeEntity/TemplateTypeEntity)
/// This mirrors the CardTypeEntity structure for stickers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StickerTypeEntity {
    /// Unique identifier
    #[serde(default)]
    pub id: i64,
    /// Display name (e.g., "Poster", "Backdrop", "Character")
    #[serde(default)]
    pub name: String,
    /// Description of what this sticker type represents
    #[serde(default)]
    pub description: String,
    /// Category grouping (e.g., "Movie/TV", "Videogame", "Anime")
    #[serde(default)]
    pub category: String,
    /// Associated source type (e.g., "movie", "tv", "videogame", "anime", "sports_league", "animal")
    #[serde(default)]
    pub source_type: Option<String>,
    /// DaisyUI badge class for styling (e.g., "badge-primary")
    #[serde(default)]
    pub badge_color: String,
    /// Sort order within category (lower = first)
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
