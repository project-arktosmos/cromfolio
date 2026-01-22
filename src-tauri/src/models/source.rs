use serde::{Deserialize, Serialize};

/// Source entity for tracking external source IDs and preventing duplicates
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub album_id: String,
    #[serde(default)]
    pub source_type: String,
    #[serde(default)]
    pub external_id: String,
    #[serde(default)]
    pub external_id_type: String,
    #[serde(default)]
    pub created_at: String,
}
