use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::ImageItem;

const TVMAZE_BASE_URL: &str = "https://api.tvmaze.com";

#[derive(Debug, Deserialize)]
struct TvMazeLookupResponse {
    id: i64,
    name: String,
    image: Option<TvMazeImage>,
}

#[derive(Debug, Deserialize)]
struct TvMazeImage {
    medium: Option<String>,
    original: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TvMazeShowImagesResponse {
    id: i64,
    #[serde(rename = "type")]
    image_type: String,
    resolutions: TvMazeResolutions,
}

#[derive(Debug, Deserialize)]
struct TvMazeResolutions {
    original: Option<TvMazeResolution>,
    medium: Option<TvMazeResolution>,
}

#[derive(Debug, Deserialize)]
struct TvMazeResolution {
    url: String,
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
}

pub struct TvMazeApi;

impl TvMazeApi {
    /// Lookup show by IMDb ID and get its images
    pub async fn get_images_by_imdb(
        client: &ApiClient,
        imdb_id: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        // First, lookup the show by IMDb ID
        let lookup_url = format!(
            "{}/lookup/shows?imdb={}",
            TVMAZE_BASE_URL, imdb_id
        );

        let response = client.get("tvmaze", &lookup_url).await;

        let show: TvMazeLookupResponse = match response {
            Ok(r) => r.json().await.map_err(|e| ApiError::InvalidResponse(e.to_string()))?,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        // Now get all images for the show
        Self::get_images_by_tvmaze_id(client, show.id).await
    }

    /// Get images by TVMaze show ID
    pub async fn get_images_by_tvmaze_id(
        client: &ApiClient,
        tvmaze_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let images_url = format!(
            "{}/shows/{}/images",
            TVMAZE_BASE_URL, tvmaze_id
        );

        let response = client.get("tvmaze", &images_url).await;

        let data: Vec<TvMazeShowImagesResponse> = match response {
            Ok(r) => r.json().await.map_err(|e| ApiError::InvalidResponse(e.to_string()))?,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let mut images = Vec::new();

        for img in data {
            if let Some(original) = img.resolutions.original {
                let thumb_url = img.resolutions.medium
                    .map(|m| m.url)
                    .unwrap_or_else(|| original.url.clone());

                images.push(ImageItem {
                    url: original.url,
                    thumb_url,
                    image_type: Self::map_image_type(&img.image_type),
                    source: "tvmaze".to_string(),
                    width: original.width,
                    height: original.height,
                });
            }
        }

        Ok(images)
    }

    fn map_image_type(tvmaze_type: &str) -> String {
        match tvmaze_type {
            "poster" => "poster".to_string(),
            "background" => "background".to_string(),
            "banner" => "banner".to_string(),
            "typography" => "logo".to_string(),
            _ => tvmaze_type.to_string(),
        }
    }
}
