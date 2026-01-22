use serde::{Deserialize, Serialize};

/// Trivia question entity for album-based trivia games
/// Each question belongs to an album and has ABC answers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub album_id: String,
    #[serde(default)]
    pub question_text: String,

    // ABC answer options
    #[serde(default)]
    pub answer_a: String,
    #[serde(default)]
    pub answer_b: String,
    #[serde(default)]
    pub answer_c: String,

    // Correct answer: 'a', 'b', or 'c'
    #[serde(default)]
    pub correct_answer: String,

    // Optional difficulty level
    #[serde(default)]
    pub difficulty: Option<String>,

    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
