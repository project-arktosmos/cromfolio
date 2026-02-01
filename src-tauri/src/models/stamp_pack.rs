use serde::{Deserialize, Serialize};

/// Stamp pack entity for imported sticker packs (WhatsApp, Telegram, etc.)
/// Service-agnostic - the `source` field indicates where the pack came from
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StampPack {
    #[serde(default)]
    pub id: String,
    /// Source of the sticker pack (e.g., "whatsapp", "telegram")
    #[serde(default)]
    pub source: String,
    /// Pack name (from title.txt or pack metadata)
    #[serde(default)]
    pub name: String,
    /// Pack author/publisher
    #[serde(default)]
    pub author: String,
    /// Path to tray/icon image (relative to app data dir)
    #[serde(default)]
    pub tray_image: Option<String>,
    /// Path to the original pack file (relative to app data dir)
    #[serde(default)]
    pub pack_file: Option<String>,
    /// Number of stickers in the pack
    #[serde(default)]
    pub sticker_count: i32,
    /// Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
