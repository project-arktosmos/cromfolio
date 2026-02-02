use serde::{Deserialize, Serialize};

/// Enhanced Pokemon Trivia Template V2
/// Supports 9 different template types with configurable conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PokemonTriviaTemplateV2 {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// Template type: attribute_guess, stat_comparison, type_guess, image_guess, etc.
    pub template_type: String,
    /// Question template with placeholders like {{pokemon.name}}, {{pokemon.type1}}
    pub question_template: String,
    /// Answer template for displaying the correct answer
    #[serde(default)]
    pub answer_template: String,
    /// Primary attribute being tested (e.g., "type1", "generation", "stat_hp")
    pub primary_attribute: String,
    /// JSON array of condition objects: [{key, operator, value}]
    #[serde(default = "default_conditions")]
    pub conditions: String,
    /// Logic for combining conditions: "and" or "or"
    #[serde(default = "default_condition_logic")]
    pub condition_logic: String,
    /// JSON object for scope filtering: {generations: [], types: [], etc.}
    #[serde(default = "default_scope_filters")]
    pub scope_filters: String,
    /// JSON config for comparison-type templates (stat comparisons, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparison_config: Option<String>,
    /// Difficulty level: easy, medium, hard, extreme
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,
    /// Selection weight (higher = more likely to be selected)
    #[serde(default = "default_weight")]
    pub weight: i32,
    /// Whether this template is active
    #[serde(default = "default_is_active")]
    pub is_active: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_conditions() -> String {
    "[]".to_string()
}

fn default_condition_logic() -> String {
    "and".to_string()
}

fn default_scope_filters() -> String {
    "{}".to_string()
}

fn default_weight() -> i32 {
    100
}

fn default_is_active() -> bool {
    true
}
