use serde::{Deserialize, Serialize};

/// Provider entity for tracking external provider IDs and preventing duplicates (formerly Source)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub source_id: String,
    #[serde(default)]
    pub provider_type: String,
    #[serde(default)]
    pub external_id: String,
    #[serde(default)]
    pub external_id_type: String,
    #[serde(default)]
    pub created_at: String,
}
