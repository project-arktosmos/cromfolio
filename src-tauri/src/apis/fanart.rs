use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::ImageItem;

const FANART_BASE_URL: &str = "https://webservice.fanart.tv/v3";

#[derive(Debug, Deserialize)]
struct FanartMovieResponse {
    #[serde(default)]
    movieposter: Vec<FanartImage>,
    #[serde(default)]
    moviebackground: Vec<FanartImage>,
    #[serde(default)]
    movielogo: Vec<FanartImage>,
    #[serde(default)]
    hdmovielogo: Vec<FanartImage>,
    #[serde(default)]
    moviethumb: Vec<FanartImage>,
    #[serde(default)]
    moviebanner: Vec<FanartImage>,
    #[serde(default)]
    moviedisc: Vec<FanartImage>,
    #[serde(default)]
    hdmovieclearart: Vec<FanartImage>,
    #[serde(default)]
    movieart: Vec<FanartImage>,
}

#[derive(Debug, Deserialize)]
struct FanartTvResponse {
    #[serde(default)]
    tvposter: Vec<FanartImage>,
    #[serde(default)]
    showbackground: Vec<FanartImage>,
    #[serde(default)]
    hdtvlogo: Vec<FanartImage>,
    #[serde(default)]
    clearlogo: Vec<FanartImage>,
    #[serde(default)]
    tvthumb: Vec<FanartImage>,
    #[serde(default)]
    tvbanner: Vec<FanartImage>,
    #[serde(default)]
    characterart: Vec<FanartImage>,
    #[serde(default)]
    hdclearart: Vec<FanartImage>,
    #[serde(default)]
    clearart: Vec<FanartImage>,
    #[serde(default)]
    seasonposter: Vec<FanartImage>,
    #[serde(default)]
    seasonthumb: Vec<FanartImage>,
    #[serde(default)]
    seasonbanner: Vec<FanartImage>,
}

#[derive(Debug, Deserialize)]
struct FanartMusicResponse {
    #[serde(default)]
    artistbackground: Vec<FanartImage>,
    #[serde(default)]
    artistthumb: Vec<FanartImage>,
    #[serde(default)]
    hdmusiclogo: Vec<FanartImage>,
    #[serde(default)]
    musiclogo: Vec<FanartImage>,
    #[serde(default)]
    musicbanner: Vec<FanartImage>,
    #[serde(default)]
    albums: std::collections::HashMap<String, FanartAlbum>,
}

#[derive(Debug, Deserialize)]
struct FanartAlbum {
    #[serde(default)]
    albumcover: Vec<FanartImage>,
    #[serde(default)]
    cdart: Vec<FanartImage>,
}

#[derive(Debug, Deserialize)]
struct FanartImage {
    url: String,
    #[serde(default)]
    likes: String,
}

pub struct FanartApi;

impl FanartApi {
    /// Get movie images from Fanart.tv
    pub async fn get_movie_images(
        client: &ApiClient,
        api_key: &str,
        tmdb_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/movies/{}?api_key={}",
            FANART_BASE_URL, tmdb_id, api_key
        );

        let response = client.get("fanart", &url).await;

        // Fanart.tv returns 404 if no images found
        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: FanartMovieResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut images = Vec::new();

        Self::add_images(&mut images, data.movieposter, "poster");
        Self::add_images(&mut images, data.moviebackground, "background");
        Self::add_images(&mut images, data.movielogo, "logo");
        Self::add_images(&mut images, data.hdmovielogo, "hdlogo");
        Self::add_images(&mut images, data.moviethumb, "thumb");
        Self::add_images(&mut images, data.moviebanner, "banner");
        Self::add_images(&mut images, data.moviedisc, "disc");
        Self::add_images(&mut images, data.hdmovieclearart, "clearart");
        Self::add_images(&mut images, data.movieart, "art");

        Ok(images)
    }

    /// Get TV images from Fanart.tv using TVDB ID
    pub async fn get_tv_images(
        client: &ApiClient,
        api_key: &str,
        tvdb_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/tv/{}?api_key={}",
            FANART_BASE_URL, tvdb_id, api_key
        );

        let response = client.get("fanart", &url).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: FanartTvResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut images = Vec::new();

        Self::add_images(&mut images, data.tvposter, "poster");
        Self::add_images(&mut images, data.showbackground, "background");
        Self::add_images(&mut images, data.hdtvlogo, "hdlogo");
        Self::add_images(&mut images, data.clearlogo, "logo");
        Self::add_images(&mut images, data.tvthumb, "thumb");
        Self::add_images(&mut images, data.tvbanner, "banner");
        Self::add_images(&mut images, data.characterart, "characterart");
        Self::add_images(&mut images, data.hdclearart, "clearart");
        Self::add_images(&mut images, data.clearart, "clearart");
        Self::add_images(&mut images, data.seasonposter, "seasonposter");
        Self::add_images(&mut images, data.seasonthumb, "seasonthumb");
        Self::add_images(&mut images, data.seasonbanner, "seasonbanner");

        Ok(images)
    }

    /// Get music artist images from Fanart.tv using MusicBrainz ID
    pub async fn get_music_images(
        client: &ApiClient,
        api_key: &str,
        mbid: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/music/{}?api_key={}",
            FANART_BASE_URL, mbid, api_key
        );

        let response = client.get("fanart", &url).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: FanartMusicResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut images = Vec::new();

        Self::add_images(&mut images, data.artistbackground, "background");
        Self::add_images(&mut images, data.artistthumb, "thumb");
        Self::add_images(&mut images, data.hdmusiclogo, "hdlogo");
        Self::add_images(&mut images, data.musiclogo, "logo");
        Self::add_images(&mut images, data.musicbanner, "banner");

        // Add album covers
        for (_album_id, album) in data.albums {
            Self::add_images(&mut images, album.albumcover, "albumcover");
            Self::add_images(&mut images, album.cdart, "cdart");
        }

        Ok(images)
    }

    fn add_images(images: &mut Vec<ImageItem>, source: Vec<FanartImage>, image_type: &str) {
        for img in source {
            // Fanart.tv provides preview URLs by replacing /fanart/ with /preview/
            let thumb_url = img.url.replace("/fanart/", "/preview/");

            images.push(ImageItem {
                url: img.url,
                thumb_url,
                image_type: image_type.to_string(),
                source: "fanart".to_string(),
                width: None,
                height: None,
            });
        }
    }
}
