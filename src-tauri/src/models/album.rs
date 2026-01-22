use serde::{Deserialize, Serialize};

/// Album type enum for categorizing albums
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AlbumType {
    Movie,
    Tv,
    Videogame,
    Anime,
    SportsLeague,
    Animal,
    Musician,
    Author,
}

impl Default for AlbumType {
    fn default() -> Self {
        AlbumType::Movie
    }
}

impl std::fmt::Display for AlbumType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlbumType::Movie => write!(f, "movie"),
            AlbumType::Tv => write!(f, "tv"),
            AlbumType::Videogame => write!(f, "videogame"),
            AlbumType::Anime => write!(f, "anime"),
            AlbumType::SportsLeague => write!(f, "sports_league"),
            AlbumType::Animal => write!(f, "animal"),
            AlbumType::Musician => write!(f, "musician"),
            AlbumType::Author => write!(f, "author"),
        }
    }
}

impl AlbumType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "movie" => AlbumType::Movie,
            "tv" => AlbumType::Tv,
            "videogame" => AlbumType::Videogame,
            "anime" => AlbumType::Anime,
            "sports_league" => AlbumType::SportsLeague,
            "animal" => AlbumType::Animal,
            "musician" => AlbumType::Musician,
            "author" => AlbumType::Author,
            _ => AlbumType::Movie,
        }
    }
}

/// Album entity for collectible card albums
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub album_type: AlbumType,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub cover_image: Option<String>,
    #[serde(default)]
    pub wikia_url: Option<String>,

    // Movie/TV metadata
    #[serde(default)]
    pub imdb_id: Option<String>,
    #[serde(default)]
    pub tmdb_id: Option<i32>,

    // Videogame metadata
    #[serde(default)]
    pub igdb_id: Option<i32>,
    #[serde(default)]
    pub igdb_slug: Option<String>,
    #[serde(default)]
    pub sgdb_id: Option<i32>,

    // Anime metadata
    #[serde(default)]
    pub anilist_id: Option<i32>,
    #[serde(default)]
    pub mal_id: Option<i32>,

    // Sports metadata
    #[serde(default)]
    pub sports_type: Option<String>,
    #[serde(default)]
    pub sports_db_team_id: Option<String>,
    #[serde(default)]
    pub sports_db_league_id: Option<String>,
    #[serde(default)]
    pub sports_db_player_id: Option<String>,
    #[serde(default)]
    pub sport: Option<String>,
    #[serde(default)]
    pub league: Option<String>,
    #[serde(default)]
    pub country: Option<String>,

    // Animal metadata
    #[serde(default)]
    pub wikidata_id: Option<String>,
    #[serde(default)]
    pub scientific_name: Option<String>,
    #[serde(default)]
    pub conservation_status: Option<String>,
    #[serde(default)]
    pub taxonomic_class: Option<String>,

    // Music metadata
    #[serde(default)]
    pub musicbrainz_artist_id: Option<String>,
    #[serde(default)]
    pub musicbrainz_release_id: Option<String>,
    #[serde(default)]
    pub artist_name: Option<String>,
    #[serde(default)]
    pub music_type: Option<String>,
    #[serde(default)]
    pub music_genres: Option<Vec<String>>,
    #[serde(default)]
    pub release_year: Option<i32>,
    #[serde(default)]
    pub record_label: Option<String>,

    // Book metadata
    #[serde(default)]
    pub open_library_author_id: Option<String>,
    #[serde(default)]
    pub open_library_work_id: Option<String>,
    #[serde(default)]
    pub author_name: Option<String>,
    #[serde(default)]
    pub book_type: Option<String>,
    #[serde(default)]
    pub book_subjects: Option<Vec<String>>,
    #[serde(default)]
    pub first_publish_year: Option<i32>,
    #[serde(default)]
    pub publisher: Option<String>,

    // Timestamps
    #[serde(default)]
    pub added_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
