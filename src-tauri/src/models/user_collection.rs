use serde::{Deserialize, Serialize};

/// User collection progress entity - tracks user progress on collections
/// Stored in the _user_collections table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserCollection {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub collection_id: i64,

    // Timestamp when the user started this collection
    #[serde(default)]
    pub started_at: String,

    // Timestamp when completed (null if not completed)
    #[serde(default)]
    pub completed_at: Option<String>,
}
