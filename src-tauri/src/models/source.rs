use serde::{Deserialize, Serialize};

/// Source type enum for categorizing sources (formerly AlbumType)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Movie,
    Tv,
    Videogame,
    Anime,
    SportsLeague,
    Animal,
    AwardList,
}

impl Default for SourceType {
    fn default() -> Self {
        SourceType::Movie
    }
}

impl std::fmt::Display for SourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SourceType::Movie => write!(f, "movie"),
            SourceType::Tv => write!(f, "tv"),
            SourceType::Videogame => write!(f, "videogame"),
            SourceType::Anime => write!(f, "anime"),
            SourceType::SportsLeague => write!(f, "sports_league"),
            SourceType::Animal => write!(f, "animal"),
            SourceType::AwardList => write!(f, "award_list"),
        }
    }
}

impl SourceType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "movie" => SourceType::Movie,
            "tv" => SourceType::Tv,
            "videogame" => SourceType::Videogame,
            "anime" => SourceType::Anime,
            "sports_league" => SourceType::SportsLeague,
            "animal" => SourceType::Animal,
            "award_list" => SourceType::AwardList,
            _ => SourceType::Movie,
        }
    }
}

/// Source entity for collectible card sources (formerly Album)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub source_type: SourceType,
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

    // Timestamps
    #[serde(default)]
    pub added_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
