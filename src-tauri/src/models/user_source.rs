use serde::{Deserialize, Serialize};

/// User-owned source entity - tracks which sources a user owns
/// Stored in the _user_sources table (prefixed with _ for user data separation)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSource {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub source_id: i64,

    // Timestamp when the source was acquired
    #[serde(default)]
    pub acquired_at: String,
}
