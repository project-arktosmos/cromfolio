use reqwest::blocking::Client;
use std::time::Duration;

use super::types::{TelegramFile, TelegramResponse, TelegramStickerSet};

pub struct TelegramClient {
    client: Client,
    bot_token: String,
}

impl TelegramClient {
    pub fn new(bot_token: String) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self { client, bot_token })
    }

    pub fn get_sticker_set(&self, name: &str) -> Result<TelegramStickerSet, String> {
        let url = format!(
            "https://api.telegram.org/bot{}/getStickerSet?name={}",
            self.bot_token, name
        );

        let response: TelegramResponse<TelegramStickerSet> = self
            .client
            .get(&url)
            .send()
            .map_err(|e| format!("Request failed: {}", e))?
            .json()
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if !response.ok {
            return Err(response
                .description
                .unwrap_or_else(|| "Unknown error".to_string()));
        }

        response
            .result
            .ok_or_else(|| "No result in response".to_string())
    }

    pub fn get_file(&self, file_id: &str) -> Result<TelegramFile, String> {
        let url = format!(
            "https://api.telegram.org/bot{}/getFile?file_id={}",
            self.bot_token, file_id
        );

        let response: TelegramResponse<TelegramFile> = self
            .client
            .get(&url)
            .send()
            .map_err(|e| format!("Request failed: {}", e))?
            .json()
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if !response.ok {
            return Err(response
                .description
                .unwrap_or_else(|| "Unknown error".to_string()));
        }

        response
            .result
            .ok_or_else(|| "No result in response".to_string())
    }

    pub fn download_file(&self, file_path: &str) -> Result<Vec<u8>, String> {
        let url = format!(
            "https://api.telegram.org/file/bot{}/{}",
            self.bot_token, file_path
        );

        let response = self
            .client
            .get(&url)
            .send()
            .map_err(|e| format!("Download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()));
        }

        response
            .bytes()
            .map(|b| b.to_vec())
            .map_err(|e| format!("Failed to read bytes: {}", e))
    }
}
