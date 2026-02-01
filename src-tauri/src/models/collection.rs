use serde::{Deserialize, Serialize};

/// Collection entity for grouping stickers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub collection_type_id: Option<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub cover_image: Option<String>,

    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// Junction table entity for collection-sticker relationships (formerly CollectionBlueprint/CollectionTemplate)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSticker {
    #[serde(default)]
    pub collection_id: String,
    #[serde(default)]
    pub sticker_id: String,
    #[serde(default)]
    pub sort_order: i32,

    // Timestamp
    #[serde(default)]
    pub added_at: String,
}
