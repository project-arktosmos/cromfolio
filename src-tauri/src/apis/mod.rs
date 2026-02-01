pub mod client;
pub mod config;
pub mod types;

// API implementations
pub mod omdb;
pub mod tmdb;
pub mod tvmaze;
pub mod igdb;
pub mod sgdb;
pub mod anilist;
pub mod jikan;
pub mod sports;
pub mod wikidata;
pub mod inaturalist;
pub mod llm;

pub use client::ApiClient;
pub use config::ApiConfig;
pub use types::*;
pub use llm::{LlmApi, LlmModel, ChatMessagePayload, LlmChatOptions};
