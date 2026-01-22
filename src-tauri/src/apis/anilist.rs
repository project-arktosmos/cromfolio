use serde::{Deserialize, Serialize};
use super::client::{ApiClient, ApiError};
use super::types::{AnimeSearchResult, ImageItem, CharacterItem};

const ANILIST_GRAPHQL_URL: &str = "https://graphql.anilist.co";

#[derive(Debug, Serialize)]
struct GraphQLQuery {
    query: String,
    variables: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct AniListSearchResponse {
    data: AniListSearchData,
}

#[derive(Debug, Deserialize)]
struct AniListSearchData {
    #[serde(rename = "Page")]
    page: AniListPage,
}

#[derive(Debug, Deserialize)]
struct AniListPage {
    media: Vec<AniListMedia>,
}

#[derive(Debug, Deserialize)]
struct AniListMedia {
    id: i64,
    title: AniListTitle,
    #[serde(rename = "coverImage")]
    cover_image: AniListCoverImage,
    #[serde(rename = "bannerImage")]
    banner_image: Option<String>,
    description: Option<String>,
    #[serde(rename = "startDate")]
    start_date: Option<AniListDate>,
    season: Option<String>,
    format: Option<String>,
    status: Option<String>,
    episodes: Option<i32>,
    genres: Option<Vec<String>>,
    #[serde(rename = "averageScore")]
    average_score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct AniListTitle {
    romaji: String,
    english: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AniListCoverImage {
    large: String,
    medium: String,
    #[serde(rename = "extraLarge")]
    extra_large: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AniListDate {
    year: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct AniListCharactersResponse {
    data: AniListCharactersData,
}

#[derive(Debug, Deserialize)]
struct AniListCharactersData {
    #[serde(rename = "Media")]
    media: AniListMediaCharacters,
}

#[derive(Debug, Deserialize)]
struct AniListMediaCharacters {
    characters: AniListCharactersConnection,
}

#[derive(Debug, Deserialize)]
struct AniListCharactersConnection {
    edges: Vec<AniListCharacterEdge>,
}

#[derive(Debug, Deserialize)]
struct AniListCharacterEdge {
    node: AniListCharacterNode,
    role: String,
    #[serde(rename = "voiceActors")]
    voice_actors: Vec<AniListVoiceActor>,
}

#[derive(Debug, Deserialize)]
struct AniListCharacterNode {
    id: i64,
    name: AniListCharacterName,
    image: AniListCharacterImage,
}

#[derive(Debug, Deserialize)]
struct AniListCharacterName {
    full: String,
}

#[derive(Debug, Deserialize)]
struct AniListCharacterImage {
    large: String,
    medium: String,
}

#[derive(Debug, Deserialize)]
struct AniListVoiceActor {
    id: i64,
    name: AniListCharacterName,
    image: AniListCharacterImage,
    #[serde(rename = "languageV2")]
    language: String,
}

pub struct AniListApi;

impl AniListApi {
    const SEARCH_QUERY: &'static str = r#"
        query ($search: String, $page: Int, $perPage: Int) {
            Page(page: $page, perPage: $perPage) {
                media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                    id
                    title {
                        romaji
                        english
                    }
                    coverImage {
                        large
                        medium
                        extraLarge
                    }
                    bannerImage
                    description(asHtml: false)
                    startDate {
                        year
                    }
                    season
                    format
                    status
                    episodes
                    genres
                    averageScore
                }
            }
        }
    "#;

    const CHARACTERS_QUERY: &'static str = r#"
        query ($id: Int, $page: Int, $perPage: Int) {
            Media(id: $id, type: ANIME) {
                characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
                    edges {
                        node {
                            id
                            name {
                                full
                            }
                            image {
                                large
                                medium
                            }
                        }
                        role
                        voiceActors(language: JAPANESE, sort: RELEVANCE) {
                            id
                            name {
                                full
                            }
                            image {
                                large
                                medium
                            }
                            languageV2
                        }
                    }
                }
            }
        }
    "#;

    /// Search for anime
    pub async fn search_anime(
        client: &ApiClient,
        query: &str,
        page: i32,
        per_page: i32,
    ) -> Result<Vec<AnimeSearchResult>, ApiError> {
        let gql_query = GraphQLQuery {
            query: Self::SEARCH_QUERY.to_string(),
            variables: serde_json::json!({
                "search": query,
                "page": page,
                "perPage": per_page
            }),
        };

        let response = client.post_json("anilist", ANILIST_GRAPHQL_URL, &gql_query).await?;
        let data: AniListSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.data.page.media.into_iter().map(|media| {
            AnimeSearchResult {
                id: media.id,
                title_romaji: media.title.romaji,
                title_english: media.title.english,
                cover_image: media.cover_image.medium,
                cover_image_large: media.cover_image.extra_large.or(Some(media.cover_image.large)),
                banner_image: media.banner_image,
                description: media.description,
                start_year: media.start_date.and_then(|d| d.year),
                season: media.season,
                format: media.format,
                status: media.status,
                episodes: media.episodes,
                genres: media.genres.unwrap_or_default(),
                average_score: media.average_score,
            }
        }).collect();

        Ok(results)
    }

    /// Get characters for an anime
    pub async fn get_characters(
        client: &ApiClient,
        anime_id: i64,
        page: i32,
        per_page: i32,
    ) -> Result<Vec<CharacterItem>, ApiError> {
        let gql_query = GraphQLQuery {
            query: Self::CHARACTERS_QUERY.to_string(),
            variables: serde_json::json!({
                "id": anime_id,
                "page": page,
                "perPage": per_page
            }),
        };

        let response = client.post_json("anilist", ANILIST_GRAPHQL_URL, &gql_query).await?;
        let data: AniListCharactersResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let characters = data.data.media.characters.edges.into_iter()
            .enumerate()
            .map(|(i, edge)| {
                let voice_actor = edge.voice_actors.first();
                CharacterItem {
                    id: edge.node.id.to_string(),
                    name: edge.node.name.full,
                    character_name: voice_actor.map(|va| va.name.full.clone()),
                    profile_url: edge.node.image.large,
                    profile_thumb_url: edge.node.image.medium,
                    order: i as i32,
                    source: "anilist".to_string(),
                    is_actor_headshot: false,
                }
            })
            .collect();

        Ok(characters)
    }

    /// Get images for an anime (cover + banner as ImageItems)
    pub async fn get_anime_images(
        client: &ApiClient,
        anime_id: i64,
    ) -> Result<Vec<ImageItem>, ApiError> {
        // Re-use search to get image data for a specific ID
        let gql_query = GraphQLQuery {
            query: r#"
                query ($id: Int) {
                    Media(id: $id, type: ANIME) {
                        coverImage {
                            large
                            medium
                            extraLarge
                        }
                        bannerImage
                    }
                }
            "#.to_string(),
            variables: serde_json::json!({
                "id": anime_id
            }),
        };

        let response = client.post_json("anilist", ANILIST_GRAPHQL_URL, &gql_query).await?;

        #[derive(Debug, Deserialize)]
        struct SingleMediaResponse {
            data: SingleMediaData,
        }
        #[derive(Debug, Deserialize)]
        struct SingleMediaData {
            #[serde(rename = "Media")]
            media: AniListMediaImages,
        }
        #[derive(Debug, Deserialize)]
        struct AniListMediaImages {
            #[serde(rename = "coverImage")]
            cover_image: AniListCoverImage,
            #[serde(rename = "bannerImage")]
            banner_image: Option<String>,
        }

        let data: SingleMediaResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut images = Vec::new();

        // Add cover image
        images.push(ImageItem {
            url: data.data.media.cover_image.extra_large
                .unwrap_or_else(|| data.data.media.cover_image.large.clone()),
            thumb_url: data.data.media.cover_image.medium,
            image_type: "cover".to_string(),
            source: "anilist".to_string(),
            width: None,
            height: None,
        });

        // Add banner if available
        if let Some(banner) = data.data.media.banner_image {
            images.push(ImageItem {
                url: banner.clone(),
                thumb_url: banner,
                image_type: "banner".to_string(),
                source: "anilist".to_string(),
                width: None,
                height: None,
            });
        }

        Ok(images)
    }
}
