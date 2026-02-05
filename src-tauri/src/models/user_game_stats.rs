use serde::{Deserialize, Serialize};

/// User game statistics entity - tracks stats for each game type
/// Stored in the _user_game_stats table (prefixed with _ for user data separation)
/// Each game type (e.g., "pokemon-trivia", "guess-the-name") has its own row
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserGameStats {
    #[serde(default)]
    pub id: i64,
    /// The type of game (e.g., "pokemon-trivia", "guess-the-name")
    #[serde(default)]
    pub game_type: String,
    #[serde(default)]
    pub total_games_played: i64,
    #[serde(default)]
    pub total_score: i64,
    #[serde(default)]
    pub best_score: i64,
    #[serde(default)]
    pub total_correct: i64,
    #[serde(default)]
    pub total_wrong: i64,
    #[serde(default)]
    pub best_streak: i64,
    #[serde(default)]
    pub longest_game: i64,
    #[serde(default)]
    pub last_played_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
