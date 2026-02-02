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
    /// Vote average / rating from TMDB (0-10 scale)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vote_average: Option<f64>,
    /// Number of likes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub likes: Option<i32>,
    /// Language/region code for the image (e.g., "en", "de")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
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

/// Game search result from IGDB or SteamGridDB
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
    /// Source of the search result: "igdb" or "sgdb"
    #[serde(default = "default_game_source")]
    pub source: String,
}

fn default_game_source() -> String {
    "igdb".to_string()
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

/// Result containing TMDB ID lookup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbIdResult {
    pub tmdb_id: i64,
    pub media_type: String,
}

/// Detailed content information from OMDB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentDetails {
    pub title: String,
    pub year: String,
    pub rated: Option<String>,
    pub released: Option<String>,
    pub runtime: Option<String>,
    pub genre: Option<String>,
    pub director: Option<String>,
    pub writer: Option<String>,
    pub actors: Option<String>,
    pub plot: Option<String>,
    pub language: Option<String>,
    pub country: Option<String>,
    pub awards: Option<String>,
    pub poster: Option<String>,
    pub imdb_rating: Option<String>,
    pub imdb_votes: Option<String>,
    pub imdb_id: String,
    pub media_type: String,
    /// Only for TV series
    pub total_seasons: Option<String>,
    /// Metascore rating
    pub metascore: Option<String>,
    /// Box office earnings (for movies)
    pub box_office: Option<String>,
    /// Production company
    pub production: Option<String>,
}

// ============================================================================
// MUSICBRAINZ TYPES
// ============================================================================

/// MusicBrainz artist search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicBrainzArtistResult {
    pub mbid: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disambiguation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_type: Option<String>,
    pub score: i32,
}

/// MusicBrainz release (album) search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicBrainzReleaseResult {
    pub mbid: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_credit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_group_mbid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_art_url: Option<String>,
    pub score: i32,
}

/// MusicBrainz recording (song) search result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicBrainzRecordingResult {
    pub mbid: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_credit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_release_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_mbid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_title: Option<String>,
    pub score: i32,
}
