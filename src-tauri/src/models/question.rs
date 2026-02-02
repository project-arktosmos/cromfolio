use serde::{Deserialize, Serialize};

/// Trivia question entity for source-based trivia games
/// Each question belongs to a source and has a correct answer with multiple wrong answers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub source_id: String,
    #[serde(default)]
    pub question_text: String,

    // The correct answer text
    #[serde(default)]
    pub correct_answer: String,

    // All wrong answer options (stored as JSON in SQLite)
    #[serde(default)]
    pub wrong_answers: Vec<String>,

    // Optional difficulty level
    #[serde(default)]
    pub difficulty: Option<String>,

    // Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
