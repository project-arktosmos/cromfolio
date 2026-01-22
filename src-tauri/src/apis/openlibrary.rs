use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{BookAuthorSearchResult, BookWorkSearchResult, ImageItem};

const OPENLIBRARY_BASE_URL: &str = "https://openlibrary.org";
const OPENLIBRARY_COVERS_URL: &str = "https://covers.openlibrary.org";

#[derive(Debug, Deserialize)]
struct AuthorSearchResponse {
    docs: Vec<AuthorDoc>,
    #[serde(rename = "numFound")]
    num_found: i32,
}

#[derive(Debug, Deserialize)]
struct AuthorDoc {
    key: String,
    name: String,
    birth_date: Option<String>,
    death_date: Option<String>,
    top_work: Option<String>,
    work_count: Option<i32>,
    top_subjects: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct WorkSearchResponse {
    docs: Vec<WorkDoc>,
    #[serde(rename = "numFound")]
    num_found: i32,
}

#[derive(Debug, Deserialize)]
struct WorkDoc {
    key: String,
    title: String,
    author_name: Option<Vec<String>>,
    author_key: Option<Vec<String>>,
    first_publish_year: Option<i32>,
    edition_count: Option<i32>,
    cover_i: Option<i64>,
    subject: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct AuthorWorksResponse {
    entries: Vec<AuthorWorkEntry>,
}

#[derive(Debug, Deserialize)]
struct AuthorWorkEntry {
    key: String,
    title: String,
    covers: Option<Vec<i64>>,
    first_publish_date: Option<String>,
}

pub struct OpenLibraryApi;

impl OpenLibraryApi {
    /// Search for authors
    pub async fn search_authors(
        client: &ApiClient,
        query: &str,
    ) -> Result<Vec<BookAuthorSearchResult>, ApiError> {
        let url = format!(
            "{}/search/authors.json?q={}&limit=20",
            OPENLIBRARY_BASE_URL,
            urlencoding::encode(query)
        );

        let response = client.get("openlibrary", &url).await?;
        let data: AuthorSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.docs.into_iter()
            .map(|author| {
                // Extract author ID from key (e.g., "/authors/OL23919A" -> "OL23919A")
                let key = author.key.trim_start_matches("/authors/").to_string();

                BookAuthorSearchResult {
                    key: key.clone(),
                    name: author.name,
                    birth_date: author.birth_date,
                    death_date: author.death_date,
                    top_work: author.top_work,
                    work_count: author.work_count,
                    image_url: Some(format!(
                        "{}/a/olid/{}-L.jpg",
                        OPENLIBRARY_COVERS_URL, key
                    )),
                    top_subjects: author.top_subjects.unwrap_or_default(),
                }
            })
            .collect();

        Ok(results)
    }

    /// Search for works/books
    pub async fn search_works(
        client: &ApiClient,
        query: &str,
    ) -> Result<Vec<BookWorkSearchResult>, ApiError> {
        let url = format!(
            "{}/search.json?q={}&limit=20",
            OPENLIBRARY_BASE_URL,
            urlencoding::encode(query)
        );

        let response = client.get("openlibrary", &url).await?;
        let data: WorkSearchResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.docs.into_iter()
            .map(|work| {
                // Extract work key (e.g., "/works/OL45883W" -> "/works/OL45883W")
                let cover_url = work.cover_i.map(|cover_id| {
                    format!("{}/b/id/{}-L.jpg", OPENLIBRARY_COVERS_URL, cover_id)
                });

                BookWorkSearchResult {
                    key: work.key,
                    title: work.title,
                    author_name: work.author_name.and_then(|names| names.into_iter().next()),
                    author_key: work.author_key.and_then(|keys| keys.into_iter().next()),
                    first_publish_year: work.first_publish_year,
                    edition_count: work.edition_count,
                    cover_url,
                    subjects: work.subject.unwrap_or_default().into_iter().take(5).collect(),
                }
            })
            .collect();

        Ok(results)
    }

    /// Get works by an author
    pub async fn get_author_works(
        client: &ApiClient,
        author_key: &str,
        limit: i32,
    ) -> Result<Vec<BookWorkSearchResult>, ApiError> {
        // Ensure proper key format
        let key = if author_key.starts_with("/authors/") {
            author_key.to_string()
        } else {
            format!("/authors/{}", author_key)
        };

        let url = format!(
            "{}{}/works.json?limit={}",
            OPENLIBRARY_BASE_URL, key, limit
        );

        let response = client.get("openlibrary", &url).await?;
        let data: AuthorWorksResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.entries.into_iter()
            .map(|entry| {
                let cover_url = entry.covers
                    .and_then(|covers| covers.into_iter().next())
                    .map(|cover_id| {
                        format!("{}/b/id/{}-L.jpg", OPENLIBRARY_COVERS_URL, cover_id)
                    });

                let first_publish_year = entry.first_publish_date
                    .and_then(|d| {
                        // Try to extract year from various date formats
                        d.split(|c: char| !c.is_numeric())
                            .find(|s| s.len() == 4)
                            .and_then(|y| y.parse().ok())
                    });

                BookWorkSearchResult {
                    key: entry.key,
                    title: entry.title,
                    author_name: None,
                    author_key: Some(author_key.to_string()),
                    first_publish_year,
                    edition_count: None,
                    cover_url,
                    subjects: vec![],
                }
            })
            .collect();

        Ok(results)
    }

    /// Get cover images for a work
    pub async fn get_work_covers(
        client: &ApiClient,
        work_key: &str,
    ) -> Result<Vec<ImageItem>, ApiError> {
        // Ensure proper key format
        let key = if work_key.starts_with("/works/") {
            work_key.to_string()
        } else {
            format!("/works/{}", work_key)
        };

        let url = format!("{}{}.json", OPENLIBRARY_BASE_URL, key);

        let response = client.get("openlibrary", &url).await?;

        #[derive(Debug, Deserialize)]
        struct WorkDetail {
            covers: Option<Vec<i64>>,
        }

        let data: WorkDetail = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let images = data.covers.unwrap_or_default()
            .into_iter()
            .map(|cover_id| {
                ImageItem {
                    url: format!("{}/b/id/{}-L.jpg", OPENLIBRARY_COVERS_URL, cover_id),
                    thumb_url: format!("{}/b/id/{}-M.jpg", OPENLIBRARY_COVERS_URL, cover_id),
                    image_type: "cover".to_string(),
                    source: "openlibrary".to_string(),
                    width: None,
                    height: None,
                }
            })
            .collect();

        Ok(images)
    }

    /// Get author photo
    pub async fn get_author_image(author_key: &str) -> ImageItem {
        // Ensure proper key format
        let key = if author_key.starts_with("/authors/") {
            author_key.trim_start_matches("/authors/").to_string()
        } else {
            author_key.to_string()
        };

        ImageItem {
            url: format!("{}/a/olid/{}-L.jpg", OPENLIBRARY_COVERS_URL, key),
            thumb_url: format!("{}/a/olid/{}-M.jpg", OPENLIBRARY_COVERS_URL, key),
            image_type: "author".to_string(),
            source: "openlibrary".to_string(),
            width: None,
            height: None,
        }
    }
}
