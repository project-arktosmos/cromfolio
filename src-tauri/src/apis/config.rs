use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// API configuration holding all API keys and server URLs
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub omdb_api_key: Option<String>,
    pub tmdb_api_key: Option<String>,
    pub twitch_client_id: Option<String>,
    pub twitch_client_secret: Option<String>,
    pub steamgriddb_api_key: Option<String>,
    // LLM server defaults
    pub ollama_base_url: Option<String>,
    pub lmstudio_base_url: Option<String>,
}

impl ApiConfig {
    pub fn new() -> Self {
        Self::default()
    }

    /// Load API keys from environment variables
    pub fn from_env() -> Self {
        Self {
            omdb_api_key: std::env::var("OMDB_API_KEY").ok(),
            tmdb_api_key: std::env::var("TMDB_API_KEY").ok(),
            twitch_client_id: std::env::var("TWITCH_CLIENT_ID").ok(),
            twitch_client_secret: std::env::var("TWITCH_CLIENT_SECRET").ok(),
            steamgriddb_api_key: std::env::var("STEAMGRIDDB_API_KEY").ok(),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL").ok(),
            lmstudio_base_url: std::env::var("LMSTUDIO_BASE_URL").ok(),
        }
    }

    pub fn has_omdb_key(&self) -> bool {
        self.omdb_api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
    }

    pub fn has_tmdb_key(&self) -> bool {
        self.tmdb_api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
    }

    pub fn has_igdb_keys(&self) -> bool {
        self.twitch_client_id.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
            && self.twitch_client_secret.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
    }

    pub fn has_steamgriddb_key(&self) -> bool {
        self.steamgriddb_api_key.as_ref().map(|k| !k.is_empty()).unwrap_or(false)
    }
}

/// Thread-safe state for API configuration
pub struct ApiConfigState {
    pub config: Arc<RwLock<ApiConfig>>,
}

impl ApiConfigState {
    pub fn new(config: ApiConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
        }
    }

    pub async fn get_config(&self) -> ApiConfig {
        self.config.read().await.clone()
    }

    pub async fn update_config(&self, config: ApiConfig) {
        *self.config.write().await = config;
    }
}
