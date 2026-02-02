use serde::{Deserialize, Serialize};

/// Pokemon trivia template for generating tag-driven trivia questions
/// Templates use placeholders like {name}, {type}, {ability} that are replaced
/// with actual Pokemon tag values to generate questions dynamically
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PokemonTriviaTemplate {
    #[serde(default)]
    pub id: String,

    /// The tag key this template is based on (e.g., "type", "ability", "generation")
    #[serde(default)]
    pub tag_key: String,

    /// The question template with placeholders like {name} for Pokemon name
    /// Example: "What type is {name}?" or "Which Pokemon has the ability {ability}?"
    #[serde(default)]
    pub question_template: String,

    /// The answer template - typically references a tag value
    /// Example: "{type}" or "{ability}"
    #[serde(default)]
    pub answer_template: String,

    /// Whether this template is active and should be used for generation
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_true() -> bool {
    true
}
