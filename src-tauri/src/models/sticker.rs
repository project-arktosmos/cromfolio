use serde::{Deserialize, Serialize};

/// Sticker entity for image stickers within sources (formerly Blueprint/Template)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Sticker {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub source_id: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub image: String,

    // Sticker type ID - FK reference to sticker_types table
    #[serde(default)]
    pub sticker_type_id: Option<i64>,

    // Image source metadata
    #[serde(default)]
    pub image_source: Option<String>, // e.g., 'tmdb', 'igdb', 'anilist', 'thesportsdb'

    // Image dimensions in pixels
    #[serde(default)]
    pub width: Option<i32>,
    #[serde(default)]
    pub height: Option<i32>,

    // Fragment metadata for split stickers (e.g., winners split into 4 pieces)
    // fragment_of: ID that links all fragments of the same original sticker together
    #[serde(default)]
    pub fragment_of: Option<i64>,
    // fragment_position: 1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right
    #[serde(default)]
    pub fragment_position: Option<i32>,

    // Timestamps
    #[serde(default)]
    pub added_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,

    // Joined fields (populated from related tables)
    #[serde(default)]
    pub source_name: Option<String>,
}
