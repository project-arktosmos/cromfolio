use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{ImageItem, CharacterItem, TmdbIdResult};

const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p";

#[derive(Debug, Deserialize)]
struct TmdbFindResponse {
    movie_results: Vec<TmdbFindResult>,
    tv_results: Vec<TmdbFindResult>,
}

#[derive(Debug, Deserialize)]
struct TmdbFindResult {
    id: i64,
}

#[derive(Debug, Deserialize)]
struct TmdbImagesResponse {
    posters: Option<Vec<TmdbImage>>,
    backdrops: Option<Vec<TmdbImage>>,
    logos: Option<Vec<TmdbImage>>,
}

#[derive(Debug, Deserialize)]
struct TmdbImage {
    file_path: String,
    width: u32,
    height: u32,
    #[serde(default)]
    vote_average: f64,
    /// ISO 639-1 language code (e.g., "en", "de", null for no text)
    iso_639_1: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TmdbCreditsResponse {
    cast: Vec<TmdbCastMember>,
}

#[derive(Debug, Deserialize)]
struct TmdbCastMember {
    id: i64,
    name: String,
    character: String,
    profile_path: Option<String>,
    order: i32,
}

pub struct TmdbApi;

impl TmdbApi {
    /// Find TMDB ID from IMDb ID
    pub async fn find_by_imdb(
        client: &ApiClient,
        api_key: &str,
        imdb_id: &str,
    ) -> Result<Option<TmdbIdResult>, ApiError> {
        let url = format!(
            "{}/find/{}?api_key={}&external_source=imdb_id",
            TMDB_BASE_URL, imdb_id, api_key
        );

        let response = client.get("tmdb", &url).await?;
        let data: TmdbFindResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        // Check movie results first
        if let Some(movie) = data.movie_results.first() {
            return Ok(Some(TmdbIdResult {
                tmdb_id: movie.id,
                media_type: "movie".to_string(),
            }));
        }

        // Then check TV results
        if let Some(tv) = data.tv_results.first() {
            return Ok(Some(TmdbIdResult {
                tmdb_id: tv.id,
                media_type: "tv".to_string(),
            }));
        }

        Ok(None)
    }

    /// Get images for a movie
    pub async fn get_movie_images(
        client: &ApiClient,
        api_key: &str,
        tmdb_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/movie/{}/images?api_key={}",
            TMDB_BASE_URL, tmdb_id, api_key
        );

        let response = client.get("tmdb", &url).await?;
        let data: TmdbImagesResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(Self::convert_images(data))
    }

    /// Get images for a TV show
    pub async fn get_tv_images(
        client: &ApiClient,
        api_key: &str,
        tmdb_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/tv/{}/images?api_key={}",
            TMDB_BASE_URL, tmdb_id, api_key
        );

        let response = client.get("tmdb", &url).await?;
        let data: TmdbImagesResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(Self::convert_images(data))
    }

    /// Get cast/credits for a movie
    pub async fn get_movie_credits(
        client: &ApiClient,
        api_key: &str,
        tmdb_id: i64,
    ) -> Result<Vec<CharacterItem>, ApiError> {
        let url = format!(
            "{}/movie/{}/credits?api_key={}",
            TMDB_BASE_URL, tmdb_id, api_key
        );

        let response = client.get("tmdb", &url).await?;
        let data: TmdbCreditsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(Self::convert_cast(data.cast))
    }

    /// Get cast/credits for a TV show
    pub async fn get_tv_credits(
        client: &ApiClient,
        api_key: &str,
        tmdb_id: i64,
    ) -> Result<Vec<CharacterItem>, ApiError> {
        let url = format!(
            "{}/tv/{}/credits?api_key={}",
            TMDB_BASE_URL, tmdb_id, api_key
        );

        let response = client.get("tmdb", &url).await?;
        let data: TmdbCreditsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(Self::convert_cast(data.cast))
    }

    fn convert_images(data: TmdbImagesResponse) -> Vec<ImageItem> {
        let mut images = Vec::new();

        // Process posters
        for img in data.posters.unwrap_or_default() {
            images.push(ImageItem {
                url: format!("{}/original{}", TMDB_IMAGE_BASE, img.file_path),
                thumb_url: format!("{}/w185{}", TMDB_IMAGE_BASE, img.file_path),
                image_type: "poster".to_string(),
                source: "tmdb".to_string(),
                width: Some(img.width),
                height: Some(img.height),
                vote_average: if img.vote_average > 0.0 { Some(img.vote_average) } else { None },
                likes: None,
                language: img.iso_639_1,
            });
        }

        // Process backdrops
        for img in data.backdrops.unwrap_or_default() {
            images.push(ImageItem {
                url: format!("{}/original{}", TMDB_IMAGE_BASE, img.file_path),
                thumb_url: format!("{}/w300{}", TMDB_IMAGE_BASE, img.file_path),
                image_type: "backdrop".to_string(),
                source: "tmdb".to_string(),
                width: Some(img.width),
                height: Some(img.height),
                vote_average: if img.vote_average > 0.0 { Some(img.vote_average) } else { None },
                likes: None,
                language: img.iso_639_1,
            });
        }

        // Process logos
        for img in data.logos.unwrap_or_default() {
            images.push(ImageItem {
                url: format!("{}/original{}", TMDB_IMAGE_BASE, img.file_path),
                thumb_url: format!("{}/w185{}", TMDB_IMAGE_BASE, img.file_path),
                image_type: "logo".to_string(),
                source: "tmdb".to_string(),
                width: Some(img.width),
                height: Some(img.height),
                vote_average: if img.vote_average > 0.0 { Some(img.vote_average) } else { None },
                likes: None,
                language: img.iso_639_1,
            });
        }

        images
    }

    fn convert_cast(cast: Vec<TmdbCastMember>) -> Vec<CharacterItem> {
        cast.into_iter()
            .filter(|member| member.profile_path.is_some())
            .map(|member| {
                let profile_path = member.profile_path.unwrap();
                CharacterItem {
                    id: member.id.to_string(),
                    name: member.name,
                    character_name: Some(member.character),
                    profile_url: format!("{}/original{}", TMDB_IMAGE_BASE, profile_path),
                    profile_thumb_url: format!("{}/w185{}", TMDB_IMAGE_BASE, profile_path),
                    order: member.order,
                    source: "tmdb-cast".to_string(),
                    is_actor_headshot: true,
                }
            })
            .collect()
    }
}
