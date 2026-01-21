use serde::{Deserialize, Serialize};

/// Settings entity - singleton application settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub app_name: String,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub updated_at: String,
}
