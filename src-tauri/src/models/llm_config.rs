use serde::{Deserialize, Serialize};

/// LLM provider type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    Lmstudio,
    Ollama,
}

impl Default for LlmProvider {
    fn default() -> Self {
        LlmProvider::Lmstudio
    }
}

impl std::fmt::Display for LlmProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LlmProvider::Lmstudio => write!(f, "lmstudio"),
            LlmProvider::Ollama => write!(f, "ollama"),
        }
    }
}

impl LlmProvider {
    pub fn from_str(s: &str) -> Self {
        match s {
            "ollama" => LlmProvider::Ollama,
            _ => LlmProvider::Lmstudio,
        }
    }
}

/// LLM configuration entity for storing server connection settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub provider: LlmProvider,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
