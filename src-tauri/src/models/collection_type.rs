use serde::{Deserialize, Serialize};

/// Collection type entity for categorizing collections (e.g., anime, awards)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CollectionType {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub sort_order: i32,

    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
