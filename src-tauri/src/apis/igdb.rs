use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, Instant};
use super::client::{ApiClient, ApiError};
use super::types::{GameSearchResult, ImageItem};

const IGDB_BASE_URL: &str = "https://api.igdb.com/v4";
const TWITCH_AUTH_URL: &str = "https://id.twitch.tv/oauth2/token";

#[derive(Debug, Clone)]
struct IgdbToken {
    access_token: String,
    expires_at: Instant,
}

#[derive(Debug, Deserialize)]
struct TwitchTokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct IgdbGame {
    id: i64,
    name: String,
    slug: String,
    summary: Option<String>,
    first_release_date: Option<i64>,
    aggregated_rating: Option<f64>,
    cover: Option<IgdbCover>,
    genres: Option<Vec<IgdbGenre>>,
    platforms: Option<Vec<IgdbPlatform>>,
}

#[derive(Debug, Deserialize)]
struct IgdbCover {
    image_id: String,
}

#[derive(Debug, Deserialize)]
struct IgdbGenre {
    name: String,
}

#[derive(Debug, Deserialize)]
struct IgdbPlatform {
    name: String,
    #[serde(default)]
    abbreviation: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IgdbGameImages {
    id: i64,
    cover: Option<IgdbCover>,
    screenshots: Option<Vec<IgdbScreenshot>>,
    artworks: Option<Vec<IgdbArtwork>>,
}

#[derive(Debug, Deserialize)]
struct IgdbScreenshot {
    image_id: String,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct IgdbArtwork {
    image_id: String,
    width: Option<u32>,
    height: Option<u32>,
}

pub struct IgdbApi {
    token: Arc<RwLock<Option<IgdbToken>>>,
}

impl IgdbApi {
    pub fn new() -> Self {
        Self {
            token: Arc::new(RwLock::new(None)),
        }
    }

    /// Get or refresh access token
    async fn get_token(
        &self,
        client: &ApiClient,
        client_id: &str,
        client_secret: &str,
    ) -> Result<String, ApiError> {
        // Check if we have a valid token
        {
            let token = self.token.read().await;
            if let Some(t) = &*token {
                if t.expires_at > Instant::now() + Duration::from_secs(60) {
                    return Ok(t.access_token.clone());
                }
            }
        }

        // Need to refresh token
        let url = format!(
            "{}?client_id={}&client_secret={}&grant_type=client_credentials",
            TWITCH_AUTH_URL, client_id, client_secret
        );

        let response = client.post_json("igdb", &url, &serde_json::json!({})).await?;
        let data: TwitchTokenResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let new_token = IgdbToken {
            access_token: data.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(data.expires_in),
        };

        *self.token.write().await = Some(new_token);

        Ok(data.access_token)
    }

    /// Search for games
    pub async fn search_games(
        &self,
        client: &ApiClient,
        client_id: &str,
        client_secret: &str,
        query: &str,
    ) -> Result<Vec<GameSearchResult>, ApiError> {
        let token = self.get_token(client, client_id, client_secret).await?;

        let body = format!(
            r#"search "{}"; fields id,name,slug,summary,first_release_date,aggregated_rating,cover.image_id,genres.name,platforms.name,platforms.abbreviation; limit 20;"#,
            query.replace('"', "\\\"")
        );

        let response = client.post_with_headers(
            "igdb",
            &format!("{}/games", IGDB_BASE_URL),
            vec![
                ("Client-ID", client_id),
                ("Authorization", &format!("Bearer {}", token)),
                ("Content-Type", "text/plain"),
            ],
            &body,
        ).await?;

        let games: Vec<IgdbGame> = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = games.into_iter().map(|game| {
            let cover_url = game.cover.as_ref().map(|c| {
                format!("https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg", c.image_id)
            });
            let cover_thumb_url = game.cover.as_ref().map(|c| {
                format!("https://images.igdb.com/igdb/image/upload/t_thumb/{}.jpg", c.image_id)
            });

            GameSearchResult {
                id: game.id,
                name: game.name,
                slug: game.slug,
                summary: game.summary,
                first_release_date: game.first_release_date,
                cover_url,
                cover_thumb_url,
                rating: game.aggregated_rating,
                platforms: game.platforms.unwrap_or_default()
                    .into_iter()
                    .map(|p| p.abbreviation.unwrap_or(p.name))
                    .collect(),
                genres: game.genres.unwrap_or_default()
                    .into_iter()
                    .map(|g| g.name)
                    .collect(),
                source: "igdb".to_string(),
            }
        }).collect();

        Ok(results)
    }

    /// Get images for a game
    pub async fn get_game_images(
        &self,
        client: &ApiClient,
        client_id: &str,
        client_secret: &str,
        game_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let token = self.get_token(client, client_id, client_secret).await?;

        let body = format!(
            "fields id,cover.image_id,screenshots.image_id,screenshots.width,screenshots.height,artworks.image_id,artworks.width,artworks.height; where id = {};",
            game_id
        );

        let response = client.post_with_headers(
            "igdb",
            &format!("{}/games", IGDB_BASE_URL),
            vec![
                ("Client-ID", client_id),
                ("Authorization", &format!("Bearer {}", token)),
                ("Content-Type", "text/plain"),
            ],
            &body,
        ).await?;

        let games: Vec<IgdbGameImages> = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let game = games.into_iter().next()
            .ok_or_else(|| ApiError::NotFound)?;

        let mut images = Vec::new();

        // Add cover
        if let Some(cover) = game.cover {
            images.push(ImageItem {
                url: format!("https://images.igdb.com/igdb/image/upload/t_cover_big_2x/{}.jpg", cover.image_id),
                thumb_url: format!("https://images.igdb.com/igdb/image/upload/t_thumb/{}.jpg", cover.image_id),
                image_type: "cover".to_string(),
                source: "igdb".to_string(),
                width: None,
                height: None,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        // Add screenshots
        for screenshot in game.screenshots.unwrap_or_default() {
            images.push(ImageItem {
                url: format!("https://images.igdb.com/igdb/image/upload/t_screenshot_huge/{}.jpg", screenshot.image_id),
                thumb_url: format!("https://images.igdb.com/igdb/image/upload/t_screenshot_med/{}.jpg", screenshot.image_id),
                image_type: "screenshot".to_string(),
                source: "igdb".to_string(),
                width: screenshot.width,
                height: screenshot.height,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        // Add artworks
        for artwork in game.artworks.unwrap_or_default() {
            images.push(ImageItem {
                url: format!("https://images.igdb.com/igdb/image/upload/t_1080p/{}.jpg", artwork.image_id),
                thumb_url: format!("https://images.igdb.com/igdb/image/upload/t_thumb/{}.jpg", artwork.image_id),
                image_type: "artwork".to_string(),
                source: "igdb".to_string(),
                width: artwork.width,
                height: artwork.height,
                vote_average: None,
                likes: None,
                language: None,
            });
        }

        Ok(images)
    }
}

impl Default for IgdbApi {
    fn default() -> Self {
        Self::new()
    }
}
