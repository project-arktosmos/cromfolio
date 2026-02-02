use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{MusicBrainzArtistResult, MusicBrainzReleaseResult, MusicBrainzRecordingResult};

const MUSICBRAINZ_BASE_URL: &str = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_URL: &str = "https://coverartarchive.org";

// ============================================================================
// MUSICBRAINZ API RESPONSE TYPES (Internal)
// ============================================================================

#[derive(Debug, Deserialize)]
struct ArtistSearchResponse {
    artists: Option<Vec<MbArtist>>,
}

#[derive(Debug, Deserialize)]
struct MbArtist {
    id: String,
    name: String,
    #[serde(rename = "sort-name")]
    sort_name: Option<String>,
    disambiguation: Option<String>,
    country: Option<String>,
    #[serde(rename = "type")]
    artist_type: Option<String>,
    score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct ReleaseSearchResponse {
    releases: Option<Vec<MbRelease>>,
}

#[derive(Debug, Deserialize)]
struct MbRelease {
    id: String,
    title: String,
    #[serde(rename = "artist-credit")]
    artist_credit: Option<Vec<MbArtistCredit>>,
    date: Option<String>,
    country: Option<String>,
    status: Option<String>,
    #[serde(rename = "release-group")]
    release_group: Option<MbReleaseGroup>,
    score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct MbArtistCredit {
    name: Option<String>,
    artist: Option<MbArtistRef>,
}

#[derive(Debug, Deserialize)]
struct MbArtistRef {
    name: String,
}

#[derive(Debug, Deserialize)]
struct MbReleaseGroup {
    id: String,
}

#[derive(Debug, Deserialize)]
struct RecordingSearchResponse {
    recordings: Option<Vec<MbRecording>>,
}

#[derive(Debug, Deserialize)]
struct MbRecording {
    id: String,
    title: String,
    #[serde(rename = "artist-credit")]
    artist_credit: Option<Vec<MbArtistCredit>>,
    length: Option<i64>,
    #[serde(rename = "first-release-date")]
    first_release_date: Option<String>,
    releases: Option<Vec<MbRecordingRelease>>,
    score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct MbRecordingRelease {
    id: String,
    title: String,
}

// Cover Art Archive response
#[derive(Debug, Deserialize)]
struct CoverArtResponse {
    images: Option<Vec<CoverArtImage>>,
}

#[derive(Debug, Deserialize)]
struct CoverArtImage {
    image: String,
    thumbnails: Option<CoverArtThumbnails>,
    front: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CoverArtThumbnails {
    small: Option<String>,
    large: Option<String>,
    #[serde(rename = "250")]
    size_250: Option<String>,
    #[serde(rename = "500")]
    size_500: Option<String>,
}

// ============================================================================
// MUSICBRAINZ API IMPLEMENTATION
// ============================================================================

pub struct MusicBrainzApi;

impl MusicBrainzApi {
    /// Search for artists by name
    pub async fn search_artists(
        client: &ApiClient,
        query: &str,
        limit: i32,
    ) -> Result<Vec<MusicBrainzArtistResult>, ApiError> {
        let url = format!(
            "{}/artist/?query={}&limit={}&fmt=json",
            MUSICBRAINZ_BASE_URL,
            urlencoding::encode(query),
            limit
        );

        let response = client.get("musicbrainz", &url).await?;
        let data: ArtistSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.artists.unwrap_or_default()
            .into_iter()
            .map(|artist| MusicBrainzArtistResult {
                mbid: artist.id,
                name: artist.name,
                sort_name: artist.sort_name,
                disambiguation: artist.disambiguation,
                country: artist.country,
                artist_type: artist.artist_type,
                score: artist.score.unwrap_or(0),
            })
            .collect();

        Ok(results)
    }

    /// Search for releases (albums) by title
    pub async fn search_releases(
        client: &ApiClient,
        query: &str,
        limit: i32,
    ) -> Result<Vec<MusicBrainzReleaseResult>, ApiError> {
        let url = format!(
            "{}/release/?query={}&limit={}&fmt=json",
            MUSICBRAINZ_BASE_URL,
            urlencoding::encode(query),
            limit
        );

        let response = client.get("musicbrainz", &url).await?;
        let data: ReleaseSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut results: Vec<MusicBrainzReleaseResult> = data.releases.unwrap_or_default()
            .into_iter()
            .map(|release| {
                // Build artist credit string
                let artist_credit = release.artist_credit
                    .map(|credits| {
                        credits.into_iter()
                            .filter_map(|c| c.name.or_else(|| c.artist.map(|a| a.name)))
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .filter(|s| !s.is_empty());

                MusicBrainzReleaseResult {
                    mbid: release.id,
                    title: release.title,
                    artist_credit,
                    date: release.date,
                    country: release.country,
                    status: release.status,
                    release_group_mbid: release.release_group.map(|rg| rg.id),
                    cover_art_url: None, // Will be fetched separately
                    score: release.score.unwrap_or(0),
                }
            })
            .collect();

        // Sort by score descending
        results.sort_by(|a, b| b.score.cmp(&a.score));

        Ok(results)
    }

    /// Search for recordings (songs) by title
    pub async fn search_recordings(
        client: &ApiClient,
        query: &str,
        limit: i32,
    ) -> Result<Vec<MusicBrainzRecordingResult>, ApiError> {
        let url = format!(
            "{}/recording/?query={}&limit={}&fmt=json",
            MUSICBRAINZ_BASE_URL,
            urlencoding::encode(query),
            limit
        );

        let response = client.get("musicbrainz", &url).await?;
        let data: RecordingSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.recordings.unwrap_or_default()
            .into_iter()
            .map(|recording| {
                // Build artist credit string
                let artist_credit = recording.artist_credit
                    .map(|credits| {
                        credits.into_iter()
                            .filter_map(|c| c.name.or_else(|| c.artist.map(|a| a.name)))
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .filter(|s| !s.is_empty());

                // Get first release info
                let (release_mbid, release_title) = recording.releases
                    .and_then(|r| r.into_iter().next())
                    .map(|r| (Some(r.id), Some(r.title)))
                    .unwrap_or((None, None));

                MusicBrainzRecordingResult {
                    mbid: recording.id,
                    title: recording.title,
                    artist_credit,
                    length_ms: recording.length,
                    first_release_date: recording.first_release_date,
                    release_mbid,
                    release_title,
                    score: recording.score.unwrap_or(0),
                }
            })
            .collect();

        Ok(results)
    }

    /// Get cover art URL for a release from Cover Art Archive
    pub async fn get_release_cover_art(
        client: &ApiClient,
        release_mbid: &str,
    ) -> Result<Option<String>, ApiError> {
        let url = format!("{}/release/{}", COVER_ART_ARCHIVE_URL, release_mbid);

        // Cover Art Archive may return 404 if no artwork exists
        match client.get("coverartarchive", &url).await {
            Ok(response) => {
                let data: CoverArtResponse = response.json().await
                    .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

                // Find front cover image, or fall back to first available image
                let cover_url = data.images
                    .and_then(|images| {
                        // First try to find front cover
                        let front = images.iter()
                            .find(|img| img.front.unwrap_or(false));

                        // Use front cover or fall back to first image
                        let chosen = front.or_else(|| images.first());

                        chosen.map(|img| {
                            // Prefer 500px thumbnail, fall back to full image
                            img.thumbnails.as_ref()
                                .and_then(|t| t.size_500.clone().or(t.large.clone()).or(t.size_250.clone()))
                                .unwrap_or_else(|| img.image.clone())
                        })
                    });

                Ok(cover_url)
            }
            Err(ApiError::NotFound) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Get cover art URL from release group (fallback if release has no artwork)
    pub async fn get_release_group_cover_art(
        client: &ApiClient,
        release_group_mbid: &str,
    ) -> Result<Option<String>, ApiError> {
        let url = format!("{}/release-group/{}", COVER_ART_ARCHIVE_URL, release_group_mbid);

        match client.get("coverartarchive", &url).await {
            Ok(response) => {
                let data: CoverArtResponse = response.json().await
                    .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

                // Find front cover image, or fall back to first available image
                let cover_url = data.images
                    .and_then(|images| {
                        // First try to find front cover
                        let front = images.iter()
                            .find(|img| img.front.unwrap_or(false));

                        // Use front cover or fall back to first image
                        let chosen = front.or_else(|| images.first());

                        chosen.map(|img| {
                            img.thumbnails.as_ref()
                                .and_then(|t| t.size_500.clone().or(t.large.clone()).or(t.size_250.clone()))
                                .unwrap_or_else(|| img.image.clone())
                        })
                    });

                Ok(cover_url)
            }
            Err(ApiError::NotFound) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
