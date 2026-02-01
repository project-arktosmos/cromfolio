use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{MovieSearchResult, TvSearchResult, ContentDetails};

const OMDB_BASE_URL: &str = "https://www.omdbapi.com/";

#[derive(Debug, Deserialize)]
struct OmdbSearchResponse {
    #[serde(rename = "Search")]
    search: Option<Vec<OmdbSearchItem>>,
    #[serde(rename = "Response")]
    response: String,
    #[serde(rename = "Error")]
    error: Option<String>,
    #[serde(rename = "totalResults")]
    total_results: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OmdbSearchItem {
    #[serde(rename = "Title")]
    title: String,
    #[serde(rename = "Year")]
    year: String,
    #[serde(rename = "imdbID")]
    imdb_id: String,
    #[serde(rename = "Type")]
    media_type: String,
    #[serde(rename = "Poster")]
    poster: String,
}

#[derive(Debug, Deserialize)]
struct OmdbDetailResponse {
    #[serde(rename = "Title")]
    title: String,
    #[serde(rename = "Year")]
    year: String,
    #[serde(rename = "Rated")]
    rated: Option<String>,
    #[serde(rename = "Released")]
    released: Option<String>,
    #[serde(rename = "Runtime")]
    runtime: Option<String>,
    #[serde(rename = "Genre")]
    genre: Option<String>,
    #[serde(rename = "Director")]
    director: Option<String>,
    #[serde(rename = "Writer")]
    writer: Option<String>,
    #[serde(rename = "Actors")]
    actors: Option<String>,
    #[serde(rename = "Plot")]
    plot: Option<String>,
    #[serde(rename = "Language")]
    language: Option<String>,
    #[serde(rename = "Country")]
    country: Option<String>,
    #[serde(rename = "Awards")]
    awards: Option<String>,
    #[serde(rename = "Poster")]
    poster: Option<String>,
    #[serde(rename = "imdbRating")]
    imdb_rating: Option<String>,
    #[serde(rename = "imdbVotes")]
    imdb_votes: Option<String>,
    #[serde(rename = "imdbID")]
    imdb_id: String,
    #[serde(rename = "Type")]
    media_type: String,
    #[serde(rename = "totalSeasons")]
    total_seasons: Option<String>,
    #[serde(rename = "Metascore")]
    metascore: Option<String>,
    #[serde(rename = "BoxOffice")]
    box_office: Option<String>,
    #[serde(rename = "Production")]
    production: Option<String>,
    #[serde(rename = "Response")]
    response: String,
    #[serde(rename = "Error")]
    error: Option<String>,
}

pub struct OmdbApi;

impl OmdbApi {
    /// Search for movies
    pub async fn search_movies(
        client: &ApiClient,
        api_key: &str,
        query: &str,
        year: Option<&str>,
    ) -> Result<Vec<MovieSearchResult>, ApiError> {
        let mut url = format!(
            "{}?apikey={}&s={}&type=movie",
            OMDB_BASE_URL,
            api_key,
            urlencoding::encode(query)
        );

        if let Some(y) = year {
            url.push_str(&format!("&y={}", y));
        }

        let response = client.get("omdb", &url).await?;
        let data: OmdbSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        if data.response == "False" {
            if let Some(error) = data.error {
                if error.contains("not found") || error.contains("No results") {
                    return Ok(vec![]);
                }
                return Err(ApiError::InvalidResponse(error));
            }
            return Ok(vec![]);
        }

        let results = data.search.unwrap_or_default()
            .into_iter()
            .map(|item| MovieSearchResult {
                title: item.title,
                year: item.year,
                imdb_id: item.imdb_id,
                media_type: item.media_type,
                poster: if item.poster == "N/A" { None } else { Some(item.poster) },
            })
            .collect();

        Ok(results)
    }

    /// Search for TV shows
    pub async fn search_tv(
        client: &ApiClient,
        api_key: &str,
        query: &str,
        year: Option<&str>,
    ) -> Result<Vec<TvSearchResult>, ApiError> {
        let mut url = format!(
            "{}?apikey={}&s={}&type=series",
            OMDB_BASE_URL,
            api_key,
            urlencoding::encode(query)
        );

        if let Some(y) = year {
            url.push_str(&format!("&y={}", y));
        }

        let response = client.get("omdb", &url).await?;
        let data: OmdbSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        if data.response == "False" {
            if let Some(error) = data.error {
                if error.contains("not found") || error.contains("No results") {
                    return Ok(vec![]);
                }
                return Err(ApiError::InvalidResponse(error));
            }
            return Ok(vec![]);
        }

        let results = data.search.unwrap_or_default()
            .into_iter()
            .map(|item| TvSearchResult {
                title: item.title,
                year: item.year,
                imdb_id: item.imdb_id,
                media_type: item.media_type,
                poster: if item.poster == "N/A" { None } else { Some(item.poster) },
            })
            .collect();

        Ok(results)
    }

    /// Get detailed information for a movie or TV show by IMDb ID
    pub async fn get_by_imdb_id(
        client: &ApiClient,
        api_key: &str,
        imdb_id: &str,
    ) -> Result<ContentDetails, ApiError> {
        let url = format!(
            "{}?apikey={}&i={}&plot=full",
            OMDB_BASE_URL,
            api_key,
            imdb_id
        );

        let response = client.get("omdb", &url).await?;
        let data: OmdbDetailResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        if data.response == "False" {
            if let Some(error) = data.error {
                return Err(ApiError::InvalidResponse(error));
            }
            return Err(ApiError::NotFound);
        }

        // Convert N/A values to None
        let clean_option = |opt: Option<String>| -> Option<String> {
            opt.filter(|s| s != "N/A" && !s.is_empty())
        };

        Ok(ContentDetails {
            title: data.title,
            year: data.year,
            rated: clean_option(data.rated),
            released: clean_option(data.released),
            runtime: clean_option(data.runtime),
            genre: clean_option(data.genre),
            director: clean_option(data.director),
            writer: clean_option(data.writer),
            actors: clean_option(data.actors),
            plot: clean_option(data.plot),
            language: clean_option(data.language),
            country: clean_option(data.country),
            awards: clean_option(data.awards),
            poster: clean_option(data.poster),
            imdb_rating: clean_option(data.imdb_rating),
            imdb_votes: clean_option(data.imdb_votes),
            imdb_id: data.imdb_id,
            media_type: data.media_type,
            total_seasons: clean_option(data.total_seasons),
            metascore: clean_option(data.metascore),
            box_office: clean_option(data.box_office),
            production: clean_option(data.production),
        })
    }
}
