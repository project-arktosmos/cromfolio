use reqwest::{Client, Response};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("Rate limited")]
    RateLimited,

    #[error("API key missing for {0}")]
    MissingApiKey(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Not found")]
    NotFound,

    #[error("Timeout")]
    Timeout,

    #[error("Server error: {0}")]
    ServerError(String),
}

impl ApiError {
    pub fn is_retryable(&self) -> bool {
        matches!(self,
            ApiError::RateLimited |
            ApiError::Timeout |
            ApiError::ServerError(_)
        )
    }
}

/// Simple rate limiter using token bucket algorithm
pub struct RateLimiter {
    tokens: Mutex<f32>,
    max_tokens: f32,
    refill_rate: f32, // tokens per second
    last_refill: Mutex<Instant>,
}

impl RateLimiter {
    pub fn new(max_tokens: f32, refill_rate: f32) -> Self {
        Self {
            tokens: Mutex::new(max_tokens),
            max_tokens,
            refill_rate,
            last_refill: Mutex::new(Instant::now()),
        }
    }

    /// Create a rate limiter for a specific API
    pub fn for_api(api_name: &str) -> Self {
        match api_name {
            "tmdb" => Self::new(40.0, 4.0),           // 40 per 10 sec
            "igdb" => Self::new(4.0, 4.0),            // 4 per sec
            "anilist" => Self::new(90.0, 1.5),        // 90 per min
            "jikan" => Self::new(3.0, 3.0),           // 3 per sec
            "musicbrainz" => Self::new(1.0, 1.0),     // 1 per sec (strict)
            "coverartarchive" => Self::new(1.0, 1.0), // 1 per sec (separate from MB)
            "tvmaze" => Self::new(20.0, 2.0),         // 20 per 10 sec
            _ => Self::new(2.0, 2.0),                 // Conservative default
        }
    }

    pub async fn acquire(&self) {
        loop {
            // Refill tokens based on elapsed time
            {
                let mut last_refill = self.last_refill.lock().await;
                let mut tokens = self.tokens.lock().await;

                let elapsed = last_refill.elapsed().as_secs_f32();
                let new_tokens = elapsed * self.refill_rate;
                *tokens = (*tokens + new_tokens).min(self.max_tokens);
                *last_refill = Instant::now();

                if *tokens >= 1.0 {
                    *tokens -= 1.0;
                    return;
                }
            }

            // Wait a bit before trying again
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }
}

/// Shared HTTP client with rate limiting support
pub struct ApiClient {
    client: Client,
    rate_limiters: Arc<Mutex<std::collections::HashMap<String, Arc<RateLimiter>>>>,
}

impl ApiClient {
    pub fn new() -> Result<Self, ApiError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Synaxis/1.0 (https://github.com/arktosmos/synaxis)")
            .build()?;

        Ok(Self {
            client,
            rate_limiters: Arc::new(Mutex::new(std::collections::HashMap::new())),
        })
    }

    /// Get or create a rate limiter for an API
    async fn get_rate_limiter(&self, api_name: &str) -> Arc<RateLimiter> {
        let mut limiters = self.rate_limiters.lock().await;
        if !limiters.contains_key(api_name) {
            limiters.insert(
                api_name.to_string(),
                Arc::new(RateLimiter::for_api(api_name)),
            );
        }
        limiters.get(api_name).unwrap().clone()
    }

    /// Make a GET request with rate limiting
    pub async fn get(&self, api_name: &str, url: &str) -> Result<Response, ApiError> {
        let limiter = self.get_rate_limiter(api_name).await;
        limiter.acquire().await;

        let response = self.client.get(url).send().await?;
        self.check_response(response).await
    }

    /// Make a GET request with custom headers
    pub async fn get_with_headers(
        &self,
        api_name: &str,
        url: &str,
        headers: Vec<(&str, &str)>,
    ) -> Result<Response, ApiError> {
        let limiter = self.get_rate_limiter(api_name).await;
        limiter.acquire().await;

        let mut request = self.client.get(url);
        for (key, value) in headers {
            request = request.header(key, value);
        }

        let response = request.send().await?;
        self.check_response(response).await
    }

    /// Make a POST request with JSON body
    pub async fn post_json<T: serde::Serialize>(
        &self,
        api_name: &str,
        url: &str,
        body: &T,
    ) -> Result<Response, ApiError> {
        let limiter = self.get_rate_limiter(api_name).await;
        limiter.acquire().await;

        let response = self.client
            .post(url)
            .json(body)
            .send()
            .await?;

        self.check_response(response).await
    }

    /// Make a POST request with custom headers and body
    pub async fn post_with_headers(
        &self,
        api_name: &str,
        url: &str,
        headers: Vec<(&str, &str)>,
        body: &str,
    ) -> Result<Response, ApiError> {
        let limiter = self.get_rate_limiter(api_name).await;
        limiter.acquire().await;

        let mut request = self.client.post(url).body(body.to_string());
        for (key, value) in headers {
            request = request.header(key, value);
        }

        let response = request.send().await?;
        self.check_response(response).await
    }

    /// Check response status and convert to appropriate error
    async fn check_response(&self, response: Response) -> Result<Response, ApiError> {
        let status = response.status();

        if status.is_success() {
            Ok(response)
        } else if status.as_u16() == 429 {
            Err(ApiError::RateLimited)
        } else if status.as_u16() == 404 {
            Err(ApiError::NotFound)
        } else if status.is_server_error() {
            Err(ApiError::ServerError(format!("Status: {}", status)))
        } else {
            Err(ApiError::InvalidResponse(format!("Status: {}", status)))
        }
    }
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new().expect("Failed to create API client")
    }
}

/// State wrapper for Tauri
pub struct ApiClientState {
    pub client: ApiClient,
}

impl ApiClientState {
    pub fn new() -> Result<Self, ApiError> {
        Ok(Self {
            client: ApiClient::new()?,
        })
    }
}
