use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{MovieSearchResult, TvSearchResult};

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
}
