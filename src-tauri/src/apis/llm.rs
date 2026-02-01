use serde::{Deserialize, Serialize};
use super::client::{ApiClient, ApiError};

/// LLM Model information returned to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmModel {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub size: Option<i64>,
    pub modified_at: Option<String>,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

/// Chat message payload for sending to LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessagePayload {
    pub role: String,
    pub content: String,
}

/// Chat options for LLM requests
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LlmChatOptions {
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub system_prompt: Option<String>,
}

// =============================================================================
// LM Studio (OpenAI-compatible API)
// =============================================================================

#[derive(Debug, Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAIModel {
    id: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIChatResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: String,
}

// =============================================================================
// Ollama API
// =============================================================================

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaModel>>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
    size: Option<i64>,
    modified_at: Option<String>,
    details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelDetails {
    family: Option<String>,
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: OllamaChatMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaChatMessage {
    content: String,
}

// =============================================================================
// LLM API Implementation
// =============================================================================

pub struct LlmApi;

impl LlmApi {
    /// Check if the LLM server is online
    pub async fn check_health(
        client: &ApiClient,
        base_url: &str,
        provider: &str,
    ) -> Result<bool, ApiError> {
        let url = match provider {
            "ollama" => format!("{}/api/tags", base_url),
            _ => format!("{}/v1/models", base_url), // LM Studio (OpenAI-compatible)
        };

        match client.get("llm", &url).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get available models from the LLM server
    pub async fn get_models(
        client: &ApiClient,
        base_url: &str,
        provider: &str,
    ) -> Result<Vec<LlmModel>, ApiError> {
        match provider {
            "ollama" => Self::get_ollama_models(client, base_url).await,
            _ => Self::get_lmstudio_models(client, base_url).await,
        }
    }

    /// Get models from LM Studio (OpenAI-compatible API)
    async fn get_lmstudio_models(
        client: &ApiClient,
        base_url: &str,
    ) -> Result<Vec<LlmModel>, ApiError> {
        let url = format!("{}/v1/models", base_url);
        let response = client.get("llm", &url).await?;
        let data: OpenAIModelsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(data.data.into_iter().map(|m| LlmModel {
            id: m.id.clone(),
            name: m.id,
            provider: "lmstudio".to_string(),
            size: None,
            modified_at: None,
            family: None,
            parameter_size: None,
            quantization_level: None,
        }).collect())
    }

    /// Get models from Ollama
    async fn get_ollama_models(
        client: &ApiClient,
        base_url: &str,
    ) -> Result<Vec<LlmModel>, ApiError> {
        let url = format!("{}/api/tags", base_url);
        let response = client.get("llm", &url).await?;
        let data: OllamaTagsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(data.models.unwrap_or_default().into_iter().map(|m| {
            let details = m.details.as_ref();
            LlmModel {
                id: m.name.clone(),
                name: m.name,
                provider: "ollama".to_string(),
                size: m.size,
                modified_at: m.modified_at,
                family: details.and_then(|d| d.family.clone()),
                parameter_size: details.and_then(|d| d.parameter_size.clone()),
                quantization_level: details.and_then(|d| d.quantization_level.clone()),
            }
        }).collect())
    }

    /// Send a chat message and get a response (non-streaming)
    pub async fn chat(
        client: &ApiClient,
        base_url: &str,
        provider: &str,
        model: &str,
        messages: &[ChatMessagePayload],
        options: &LlmChatOptions,
    ) -> Result<String, ApiError> {
        match provider {
            "ollama" => Self::chat_ollama(client, base_url, model, messages, options).await,
            _ => Self::chat_lmstudio(client, base_url, model, messages, options).await,
        }
    }

    /// Chat with LM Studio (OpenAI-compatible API)
    async fn chat_lmstudio(
        client: &ApiClient,
        base_url: &str,
        model: &str,
        messages: &[ChatMessagePayload],
        options: &LlmChatOptions,
    ) -> Result<String, ApiError> {
        let url = format!("{}/v1/chat/completions", base_url);

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(2048),
            "stream": false
        });

        let response = client.post_json("llm", &url, &body).await?;
        let data: OpenAIChatResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        data.choices.first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| ApiError::InvalidResponse("No response from model".to_string()))
    }

    /// Chat with Ollama
    async fn chat_ollama(
        client: &ApiClient,
        base_url: &str,
        model: &str,
        messages: &[ChatMessagePayload],
        options: &LlmChatOptions,
    ) -> Result<String, ApiError> {
        let url = format!("{}/api/chat", base_url);

        let body = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "options": {
                "temperature": options.temperature.unwrap_or(0.7),
                "num_predict": options.max_tokens.unwrap_or(2048)
            }
        });

        let response = client.post_json("llm", &url, &body).await?;
        let data: OllamaChatResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(data.message.content)
    }
}
