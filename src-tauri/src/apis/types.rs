use serde::{Deserialize, Serialize};

/// Represents a fetchable image from any source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    pub url: String,
    pub thumb_url: String,
    pub image_type: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

/// Represents a character/cast member
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterItem {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_name: Option<String>,
    pub profile_url: String,
    pub profile_thumb_url: String,
    pub order: i32,
    pub source: String,
    pub is_actor_headshot: bool,
}

/// Status of a fetch operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FetchStatus {
    Pending,
    Fetching,
    Success,
    Failed,
    RateLimited,
    Timeout,
}

/// Progress event emitted during fetch operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchProgressEvent {
    pub operation_id: String,
    pub source: String,
    pub status: FetchStatus,
    pub progress: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Error information for a failed source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceError {
    pub source: String,
    pub error: String,
    pub retryable: bool,
}

/// Result of a batch fetch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFetchResult {
    pub operation_id: String,
    pub images: Vec<ImageItem>,
    pub characters: Vec<CharacterItem>,
    pub sources_completed: Vec<String>,
    pub sources_failed: Vec<SourceError>,
    pub total_duration_ms: u64,
}

/// Content types supported for fetching
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Movie,
    Tv,
    Game,
    Anime,
    Sports,
    Animal,
    Music,
    Book,
}

impl ContentType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "movie" => Some(Self::Movie),
            "tv" => Some(Self::Tv),
            "game" => Some(Self::Game),
            "anime" => Some(Self::Anime),
            "sports" => Some(Self::Sports),
            "animal" => Some(Self::Animal),
            "music" => Some(Self::Music),
            "book" => Some(Self::Book),
            _ => None,
        }
    }
}

/// Movie search result from OMDB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovieSearchResult {
    pub title: String,
    pub year: String,
    pub imdb_id: String,
    pub media_type: String,
    pub poster: Option<String>,
}

/// TV show search result from OMDB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TvSearchResult {
    pub title: String,
    pub year: String,
    pub imdb_id: String,
    pub media_type: String,
    pub poster: Option<String>,
}

/// Game search result from IGDB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSearchResult {
    pub id: i64,
    pub name: String,
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_release_date: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_thumb_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<f64>,
    pub platforms: Vec<String>,
    pub genres: Vec<String>,
}

/// Anime search result from AniList
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimeSearchResult {
    pub id: i64,
    pub title_romaji: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_english: Option<String>,
    pub cover_image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image_large: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub banner_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_year: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub season: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub episodes: Option<i32>,
    pub genres: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub average_score: Option<i32>,
}

/// Sports team search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SportsTeamSearchResult {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    pub sport: String,
    pub league: String,
    pub league_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub badge_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stadium: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formed_year: Option<String>,
}

/// Sports league search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SportsLeagueSearchResult {
    pub id: String,
    pub name: String,
    pub sport: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub badge_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub banner_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formed_year: Option<String>,
}

/// Animal/genus search result from Wikidata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimalSearchResult {
    pub wikidata_id: String,
    pub genus_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub common_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumb_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taxonomic_family: Option<String>,
}

/// Species result within a genus
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeciesResult {
    pub wikidata_id: String,
    pub scientific_name: String,
    pub species_epithet: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub common_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumb_url: Option<String>,
}

/// Music artist search result from MusicBrainz
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicArtistSearchResult {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disambiguation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub begin_year: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_year: Option<i32>,
    pub tags: Vec<String>,
}

/// Music release result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicReleaseResult {
    pub id: String,
    pub title: String,
    pub artist_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_year: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumb_url: Option<String>,
}

/// Book author search result from Open Library
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookAuthorSearchResult {
    pub key: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub birth_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub death_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_work: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub top_subjects: Vec<String>,
}

/// Book work search result from Open Library
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookWorkSearchResult {
    pub key: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_publish_year: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edition_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    pub subjects: Vec<String>,
}

/// Result containing TMDB ID lookup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbIdResult {
    pub tmdb_id: i64,
    pub media_type: String,
}
