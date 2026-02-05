use serde::{Deserialize, Serialize};

/// Tag entity for key-value tagging of stickers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub value: String,

    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// Junction table entity for sticker-tag relationships (formerly BlueprintTag/TemplateTag)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StickerTag {
    #[serde(default)]
    pub sticker_id: i64,
    #[serde(default)]
    pub tag_id: i64,

    // Timestamp
    #[serde(default)]
    pub created_at: String,
}
