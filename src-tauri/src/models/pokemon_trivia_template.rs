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

fn default_weight() -> i32 {
    100
}

fn default_condition_logic() -> String {
    "and".to_string()
}

fn default_empty_json_array() -> String {
    "[]".to_string()
}

fn default_empty_json_object() -> String {
    "{}".to_string()
}

/// Enhanced Pokemon trivia template v2 supporting 9 different question types:
/// - simple_match: Ask about a known Pokemon's attribute
/// - reverse_lookup: Find Pokemon with specific attribute
/// - superlative: Find highest/lowest in category
/// - comparison: Compare 2-4 Pokemon
/// - multi_condition: Match multiple criteria (AND/OR)
/// - range: Find Pokemon in value range
/// - negation: Find Pokemon NOT matching criteria
/// - statistical: Questions about attribute existence
/// - type_effectiveness: Type matchup questions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PokemonTriviaTemplateV2 {
    #[serde(default)]
    pub id: String,

    /// Human-readable name for the template
    #[serde(default)]
    pub name: String,

    /// Description of what this template generates
    #[serde(default)]
    pub description: String,

    /// The type of question pattern this template uses
    #[serde(default)]
    pub template_type: String,

    /// The question template with placeholders
    #[serde(default)]
    pub question_template: String,

    /// The answer template (typically "{name}" for Pokemon answer)
    #[serde(default)]
    pub answer_template: String,

    /// The primary attribute being queried (e.g., "type", "attack", "weight-kg")
    #[serde(default)]
    pub primary_attribute: String,

    /// JSON array of condition objects for filtering Pokemon
    #[serde(default = "default_empty_json_array")]
    pub conditions: String,

    /// Logic for combining conditions: "and" or "or"
    #[serde(default = "default_condition_logic")]
    pub condition_logic: String,

    /// JSON object for scope filters (e.g., {"generation": "1"})
    #[serde(default = "default_empty_json_object")]
    pub scope_filters: String,

    /// JSON object for comparison configuration (for superlative/comparison types)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparison_config: Option<String>,

    /// Difficulty level: "easy", "medium", "hard"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,

    /// Weighted random selection (higher = more likely)
    #[serde(default = "default_weight")]
    pub weight: i32,

    /// Whether this template is active and should be used for generation
    #[serde(default = "default_true")]
    pub is_active: bool,

    /// Timestamps
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
