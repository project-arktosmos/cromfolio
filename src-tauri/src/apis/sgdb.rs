use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::ImageItem;

const SGDB_BASE_URL: &str = "https://www.steamgriddb.com/api/v2";

#[derive(Debug, Deserialize)]
struct SgdbSearchResponse {
    success: bool,
    data: Vec<SgdbGame>,
}

#[derive(Debug, Deserialize)]
struct SgdbGame {
    id: i64,
    name: String,
}

#[derive(Debug, Deserialize)]
struct SgdbImagesResponse {
    success: bool,
    data: Vec<SgdbImage>,
}

#[derive(Debug, Deserialize)]
struct SgdbImage {
    url: String,
    thumb: String,
    width: Option<u32>,
    height: Option<u32>,
    style: Option<String>,
}

pub struct SgdbApi;

impl SgdbApi {
    /// Search for a game by name
    pub async fn search_game(
        client: &ApiClient,
        api_key: &str,
        query: &str,
    ) -> Result<Option<i64>, ApiError> {
        let url = format!(
            "{}/search/autocomplete/{}",
            SGDB_BASE_URL,
            urlencoding::encode(query)
        );

        let response = client.get_with_headers(
            "sgdb",
            &url,
            vec![("Authorization", &format!("Bearer {}", api_key))],
        ).await?;

        let data: SgdbSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        if !data.success || data.data.is_empty() {
            return Ok(None);
        }

        Ok(Some(data.data[0].id))
    }

    /// Get all images for a game by SGDB game ID
    pub async fn get_game_images(
        client: &ApiClient,
        api_key: &str,
        game_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let mut all_images = Vec::new();

        // Fetch grids (vertical covers)
        if let Ok(images) = Self::fetch_images(client, api_key, game_id, "grids").await {
            all_images.extend(images);
        }

        // Fetch heroes (horizontal banners)
        if let Ok(images) = Self::fetch_images(client, api_key, game_id, "heroes").await {
            all_images.extend(images);
        }

        // Fetch logos
        if let Ok(images) = Self::fetch_images(client, api_key, game_id, "logos").await {
            all_images.extend(images);
        }

        // Fetch icons
        if let Ok(images) = Self::fetch_images(client, api_key, game_id, "icons").await {
            all_images.extend(images);
        }

        Ok(all_images)
    }

    /// Get images by game name (combines search + fetch)
    pub async fn get_images_by_name(
        client: &ApiClient,
        api_key: &str,
        game_name: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let game_id = Self::search_game(client, api_key, game_name).await?
            .ok_or_else(|| ApiError::NotFound)?;

        Self::get_game_images(client, api_key, game_id).await
    }

    async fn fetch_images(
        client: &ApiClient,
        api_key: &str,
        game_id: i64,
        image_type: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/{}/game/{}",
            SGDB_BASE_URL, image_type, game_id
        );

        let response = client.get_with_headers(
            "sgdb",
            &url,
            vec![("Authorization", &format!("Bearer {}", api_key))],
        ).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: SgdbImagesResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        if !data.success {
            return Ok(vec![]);
        }

        let images = data.data.into_iter().map(|img| {
            ImageItem {
                url: img.url,
                thumb_url: img.thumb,
                image_type: Self::map_image_type(image_type, img.style.as_deref()),
                source: "sgdb".to_string(),
                width: img.width,
                height: img.height,
            }
        }).collect();

        Ok(images)
    }

    fn map_image_type(base_type: &str, style: Option<&str>) -> String {
        match (base_type, style) {
            ("grids", Some("alternate")) => "grid-alt".to_string(),
            ("grids", _) => "grid".to_string(),
            ("heroes", _) => "hero".to_string(),
            ("logos", _) => "logo".to_string(),
            ("icons", _) => "icon".to_string(),
            _ => base_type.to_string(),
        }
    }
}
