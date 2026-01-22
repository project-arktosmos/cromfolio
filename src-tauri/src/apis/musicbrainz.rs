use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{MusicArtistSearchResult, MusicReleaseResult, ImageItem};

const MUSICBRAINZ_BASE_URL: &str = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_URL: &str = "https://coverartarchive.org";

#[derive(Debug, Deserialize)]
struct MbArtistSearchResponse {
    artists: Vec<MbArtist>,
}

#[derive(Debug, Deserialize)]
struct MbArtist {
    id: String,
    name: String,
    disambiguation: Option<String>,
    #[serde(rename = "type")]
    artist_type: Option<String>,
    country: Option<String>,
    #[serde(rename = "life-span")]
    life_span: Option<MbLifeSpan>,
    tags: Option<Vec<MbTag>>,
}

#[derive(Debug, Deserialize)]
struct MbLifeSpan {
    begin: Option<String>,
    end: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MbTag {
    name: String,
    count: i32,
}

#[derive(Debug, Deserialize)]
struct MbReleaseGroupsResponse {
    #[serde(rename = "release-groups")]
    release_groups: Vec<MbReleaseGroup>,
}

#[derive(Debug, Deserialize)]
struct MbReleaseGroup {
    id: String,
    title: String,
    #[serde(rename = "primary-type")]
    primary_type: Option<String>,
    #[serde(rename = "first-release-date")]
    first_release_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CoverArtResponse {
    images: Vec<CoverArtImage>,
}

#[derive(Debug, Deserialize)]
struct CoverArtImage {
    image: String,
    thumbnails: CoverArtThumbnails,
    front: bool,
    back: bool,
}

#[derive(Debug, Deserialize)]
struct CoverArtThumbnails {
    small: Option<String>,
    large: Option<String>,
    #[serde(rename = "250")]
    size_250: Option<String>,
    #[serde(rename = "500")]
    size_500: Option<String>,
    #[serde(rename = "1200")]
    size_1200: Option<String>,
}

pub struct MusicBrainzApi;

impl MusicBrainzApi {
    /// Search for artists
    pub async fn search_artists(
        client: &ApiClient,
        query: &str,
    ) -> Result<Vec<MusicArtistSearchResult>, ApiError> {
        let url = format!(
            "{}/artist?query={}&fmt=json&limit=20",
            MUSICBRAINZ_BASE_URL,
            urlencoding::encode(query)
        );

        let response = client.get("musicbrainz", &url).await?;
        let data: MbArtistSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.artists.into_iter()
            .map(|artist| {
                let (begin_year, end_year) = artist.life_span
                    .map(|ls| {
                        let begin = ls.begin.and_then(|d| d.split('-').next().and_then(|y| y.parse().ok()));
                        let end = ls.end.and_then(|d| d.split('-').next().and_then(|y| y.parse().ok()));
                        (begin, end)
                    })
                    .unwrap_or((None, None));

                let tags = artist.tags.unwrap_or_default()
                    .into_iter()
                    .filter(|t| t.count > 0)
                    .map(|t| t.name)
                    .take(5)
                    .collect();

                MusicArtistSearchResult {
                    id: artist.id,
                    name: artist.name,
                    disambiguation: artist.disambiguation,
                    artist_type: artist.artist_type,
                    country: artist.country,
                    begin_year,
                    end_year,
                    tags,
                }
            })
            .collect();

        Ok(results)
    }

    /// Get release groups (albums) for an artist
    pub async fn get_artist_releases(
        client: &ApiClient,
        artist_id: &str,
        include_covers: bool,
    ) -> Result<Vec<MusicReleaseResult>, ApiError> {
        let url = format!(
            "{}/release-group?artist={}&type=album|ep&fmt=json&limit=100",
            MUSICBRAINZ_BASE_URL,
            artist_id
        );

        let response = client.get("musicbrainz", &url).await?;
        let data: MbReleaseGroupsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut results: Vec<MusicReleaseResult> = data.release_groups.into_iter()
            .map(|rg| {
                let release_year = rg.first_release_date
                    .and_then(|d| d.split('-').next().and_then(|y| y.parse().ok()));

                MusicReleaseResult {
                    id: rg.id.clone(),
                    title: rg.title,
                    artist_name: String::new(), // Filled later
                    release_year,
                    release_type: rg.primary_type,
                    cover_url: if include_covers {
                        Some(format!("{}/release-group/{}/front", COVER_ART_ARCHIVE_URL, rg.id))
                    } else {
                        None
                    },
                    thumb_url: if include_covers {
                        Some(format!("{}/release-group/{}/front-250", COVER_ART_ARCHIVE_URL, rg.id))
                    } else {
                        None
                    },
                }
            })
            .collect();

        // Sort by release year descending
        results.sort_by(|a, b| b.release_year.cmp(&a.release_year));

        Ok(results)
    }

    /// Get cover art for a release group
    pub async fn get_release_group_covers(
        client: &ApiClient,
        release_group_id: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        let url = format!(
            "{}/release-group/{}",
            COVER_ART_ARCHIVE_URL,
            release_group_id
        );

        let response = client.get("musicbrainz", &url).await;

        let response = match response {
            Ok(r) => r,
            Err(ApiError::NotFound) => return Ok(vec![]),
            Err(e) => return Err(e),
        };

        let data: CoverArtResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let images = data.images.into_iter()
            .map(|img| {
                let thumb_url = img.thumbnails.size_250
                    .or(img.thumbnails.small)
                    .unwrap_or_else(|| img.image.clone());

                let image_type = if img.front {
                    "front"
                } else if img.back {
                    "back"
                } else {
                    "other"
                };

                ImageItem {
                    url: img.image,
                    thumb_url,
                    image_type: image_type.to_string(),
                    source: "musicbrainz".to_string(),
                    width: None,
                    height: None,
                }
            })
            .collect();

        Ok(images)
    }
}
