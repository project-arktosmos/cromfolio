use serde::{Deserialize, Serialize};

/// Card type enum for categorizing what the card image represents
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    // Generic/fallback
    Other,

    // Movie/TV types
    Poster,
    Backdrop,
    Logo,
    Cast,           // Actor/person photo
    Characterart,   // Character artwork (from Fanart)

    // Videogame types
    Cover,
    Screenshot,
    Artwork,
    Hero,           // Wide banner image (from SGDB)
    Icon,           // Small square icon
    Grid,           // Steam grid image

    // Anime types
    Character,      // Anime/manga character
    MainCharacter,  // Main protagonist

    // Sports types
    Player,         // Sports player photo
    TeamBadge,      // Team logo/crest

    // Animal types
    Photo,          // Wildlife/nature photo

    // Music types
    Album,          // Album cover
    ArtistThumb,    // Artist photo
    ArtistBackground, // Artist background

    // Book types
    BookCover,      // Book cover image
}

impl Default for CardType {
    fn default() -> Self {
        CardType::Other
    }
}

impl std::fmt::Display for CardType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CardType::Other => write!(f, "other"),
            CardType::Poster => write!(f, "poster"),
            CardType::Backdrop => write!(f, "backdrop"),
            CardType::Logo => write!(f, "logo"),
            CardType::Cast => write!(f, "cast"),
            CardType::Characterart => write!(f, "characterart"),
            CardType::Cover => write!(f, "cover"),
            CardType::Screenshot => write!(f, "screenshot"),
            CardType::Artwork => write!(f, "artwork"),
            CardType::Hero => write!(f, "hero"),
            CardType::Icon => write!(f, "icon"),
            CardType::Grid => write!(f, "grid"),
            CardType::Character => write!(f, "character"),
            CardType::MainCharacter => write!(f, "main_character"),
            CardType::Player => write!(f, "player"),
            CardType::TeamBadge => write!(f, "team_badge"),
            CardType::Photo => write!(f, "photo"),
            CardType::Album => write!(f, "album"),
            CardType::ArtistThumb => write!(f, "artistthumb"),
            CardType::ArtistBackground => write!(f, "artistbackground"),
            CardType::BookCover => write!(f, "book_cover"),
        }
    }
}

impl CardType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "poster" => CardType::Poster,
            "backdrop" => CardType::Backdrop,
            "logo" | "hdmovielogo" | "hdtvlogo" | "clearlogo" => CardType::Logo,
            "cast" => CardType::Cast,
            "characterart" => CardType::Characterart,
            "cover" => CardType::Cover,
            "screenshot" => CardType::Screenshot,
            "artwork" => CardType::Artwork,
            "hero" => CardType::Hero,
            "icon" => CardType::Icon,
            "grid" => CardType::Grid,
            "character" => CardType::Character,
            "main-character" | "main_character" => CardType::MainCharacter,
            "player" => CardType::Player,
            "team-badge" | "team_badge" => CardType::TeamBadge,
            "photo" => CardType::Photo,
            "album" | "single" | "ep" | "compilation" | "live" => CardType::Album,
            "artistthumb" => CardType::ArtistThumb,
            "artistbackground" => CardType::ArtistBackground,
            "book-cover" | "book_cover" => CardType::BookCover,
            _ => CardType::Other,
        }
    }
}

/// Card entity for collectible cards within albums
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub album_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub image: String,

    // Card type - what this image represents
    #[serde(default)]
    pub card_type: CardType,

    // Rarity reference
    #[serde(default)]
    pub rarity_id: Option<String>,

    // Image source metadata
    #[serde(default)]
    pub image_source: Option<String>, // e.g., 'tmdb', 'fanart', 'igdb', 'anilist'

    // Music release metadata
    #[serde(default)]
    pub musicbrainz_release_group_id: Option<String>,
    #[serde(default)]
    pub release_type: Option<String>,
    #[serde(default)]
    pub release_year: Option<i32>,

    // Timestamps
    #[serde(default)]
    pub added_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
