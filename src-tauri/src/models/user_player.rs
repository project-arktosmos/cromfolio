use serde::{Deserialize, Serialize};

/// User player profile entity - tracks player name, experience, etc.
/// Stored in the _user_player table (prefixed with _ for user data separation)
/// This is a singleton table - there should only be one row with id="player"
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserPlayer {
    #[serde(default)]
    pub id: i64,
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default)]
    pub experience: i64,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub last_played_at: String,
}

fn default_name() -> String {
    "Adventurer".to_string()
}
