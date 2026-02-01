use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{ImageItem, CharacterItem};

const JIKAN_BASE_URL: &str = "https://api.jikan.moe/v4";

#[derive(Debug, Deserialize)]
struct JikanPicturesResponse {
    data: Vec<JikanPicture>,
}

#[derive(Debug, Deserialize)]
struct JikanPicture {
    jpg: JikanImageUrls,
    #[serde(default)]
    webp: Option<JikanImageUrls>,
}

#[derive(Debug, Deserialize)]
struct JikanImageUrls {
    image_url: Option<String>,
    small_image_url: Option<String>,
    large_image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JikanCharactersResponse {
    data: Vec<JikanCharacterData>,
}

#[derive(Debug, Deserialize)]
struct JikanCharacterData {
    character: JikanCharacter,
    role: String,
    #[serde(default)]
    voice_actors: Vec<JikanVoiceActor>,
}

#[derive(Debug, Deserialize)]
struct JikanCharacter {
    mal_id: i64,
    name: String,
    images: JikanCharacterImages,
}

#[derive(Debug, Deserialize)]
struct JikanCharacterImages {
    jpg: JikanImageUrls,
    #[serde(default)]
    webp: Option<JikanImageUrls>,
}

#[derive(Debug, Deserialize)]
struct JikanVoiceActor {
    person: JikanPerson,
    language: String,
}

#[derive(Debug, Deserialize)]
struct JikanPerson {
    mal_id: i64,
    name: String,
    images: JikanPersonImages,
}

#[derive(Debug, Deserialize)]
struct JikanPersonImages {
    jpg: JikanImageUrls,
}

pub struct JikanApi;

impl JikanApi {
    /// Get additional pictures for an anime by MAL ID
    pub async fn get_anime_pictures(
        client: &ApiClient,
        mal_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!("{}/anime/{}/pictures", JIKAN_BASE_URL, mal_id);

        let response = client.get("jikan", &url).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: JikanPicturesResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let images = data.data.into_iter()
            .filter_map(|pic| {
                let url = pic.jpg.large_image_url
                    .or(pic.jpg.image_url.clone())?;
                let thumb_url = pic.jpg.small_image_url
                    .or(pic.jpg.image_url)?;

                Some(ImageItem {
                    url,
                    thumb_url,
                    image_type: "picture".to_string(),
                    source: "jikan".to_string(),
                    width: None,
                    height: None,
                    vote_average: None,
                    likes: None,
                    language: None,
                })
            })
            .collect();

        Ok(images)
    }

    /// Get characters for an anime by MAL ID
    pub async fn get_anime_characters(
        client: &ApiClient,
        mal_id: i64,
    ) -> Result<Vec<CharacterItem>, ApiError> {
        let url = format!("{}/anime/{}/characters", JIKAN_BASE_URL, mal_id);

        let response = client.get("jikan", &url).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: JikanCharactersResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let characters = data.data.into_iter()
            .enumerate()
            .filter_map(|(i, char_data)| {
                let profile_url = char_data.character.images.jpg.image_url?;
                let profile_thumb_url = char_data.character.images.jpg.small_image_url
                    .unwrap_or_else(|| profile_url.clone());

                // Find Japanese voice actor
                let jp_va = char_data.voice_actors.iter()
                    .find(|va| va.language == "Japanese");

                Some(CharacterItem {
                    id: char_data.character.mal_id.to_string(),
                    name: char_data.character.name,
                    character_name: jp_va.map(|va| va.person.name.clone()),
                    profile_url,
                    profile_thumb_url,
                    order: i as i32,
                    source: "jikan".to_string(),
                    is_actor_headshot: false,
                })
            })
            .collect();

        Ok(characters)
    }

    /// Search for MAL ID from AniList ID (using title search as fallback)
    pub async fn find_mal_id(
        client: &ApiClient,
        title: &str,
    ) -> Result<Option<i64>, ApiError> {
        let url = format!(
            "{}/anime?q={}&limit=1",
            JIKAN_BASE_URL,
            urlencoding::encode(title)
        );

        let response = client.get("jikan", &url).await?;

        #[derive(Debug, Deserialize)]
        struct SearchResponse {
            data: Vec<SearchResult>,
        }
        #[derive(Debug, Deserialize)]
        struct SearchResult {
            mal_id: i64,
        }

        let data: SearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        Ok(data.data.first().map(|r| r.mal_id))
    }
}
