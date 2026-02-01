use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::ImageItem;

const INATURALIST_BASE_URL: &str = "https://api.inaturalist.org/v1";

#[derive(Debug, Deserialize)]
struct TaxaResponse {
    results: Vec<InaturalistTaxon>,
}

#[derive(Debug, Deserialize)]
struct InaturalistTaxon {
    id: i64,
    name: String,
    preferred_common_name: Option<String>,
    default_photo: Option<InaturalistPhoto>,
}

#[derive(Debug, Deserialize)]
struct InaturalistPhoto {
    id: i64,
    medium_url: Option<String>,
    square_url: Option<String>,
    url: Option<String>,
    original_url: Option<String>,
    attribution: Option<String>,
    license_code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ObservationsResponse {
    results: Vec<InaturalistObservation>,
    total_results: i64,
}

#[derive(Debug, Deserialize)]
struct InaturalistObservation {
    id: i64,
    photos: Vec<InaturalistObservationPhoto>,
}

#[derive(Debug, Deserialize)]
struct InaturalistObservationPhoto {
    id: i64,
    url: String,
    attribution: Option<String>,
    license_code: Option<String>,
}

pub struct InaturalistApi;

impl InaturalistApi {
    /// Get photos for a species by scientific name
    pub async fn get_species_photos(
        client: &ApiClient,
        scientific_name: &str,
        limit: i32,
    ) -> Result<Vec<ImageItem>, ApiError> {
        // First, find the taxon ID
        let taxon_url = format!(
            "{}/taxa?q={}&rank=species&per_page=1",
            INATURALIST_BASE_URL,
            urlencoding::encode(scientific_name)
        );

        let response = client.get("inaturalist", &taxon_url).await?;
        let taxa: TaxaResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let taxon = taxa.results.into_iter().next()
            .ok_or_else(|| ApiError::NotFound)?;

        // Now get observations with photos
        let obs_url = format!(
            "{}/observations?taxon_id={}&photos=true&quality_grade=research&per_page={}&order=votes&order_by=votes",
            INATURALIST_BASE_URL,
            taxon.id,
            limit
        );

        let response = client.get("inaturalist", &obs_url).await?;
        let observations: ObservationsResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let mut images = Vec::new();

        // Add default photo from taxon if available
        if let Some(photo) = taxon.default_photo {
            if let Some(url) = photo.original_url.or(photo.url) {
                let thumb_url = photo.square_url
                    .or(photo.medium_url)
                    .unwrap_or_else(|| url.clone());

                images.push(ImageItem {
                    url,
                    thumb_url,
                    image_type: "default".to_string(),
                    source: "inaturalist".to_string(),
                    width: None,
                    height: None,
                    vote_average: None,
                    likes: None,
                    language: None,
                });
            }
        }

        // Add photos from observations
        for obs in observations.results {
            for photo in obs.photos {
                // iNaturalist photo URLs have size suffixes like /square.jpg, /medium.jpg, etc.
                // We can modify them to get different sizes
                let original_url = Self::get_original_url(&photo.url);
                let thumb_url = Self::get_thumb_url(&photo.url);

                images.push(ImageItem {
                    url: original_url,
                    thumb_url,
                    image_type: "observation".to_string(),
                    source: "inaturalist".to_string(),
                    width: None,
                    height: None,
                    vote_average: None,
                    likes: None,
                    language: None,
                });
            }
        }

        Ok(images)
    }

    /// Search for taxa (species, genus, etc.)
    pub async fn search_taxa(
        client: &ApiClient,
        query: &str,
        rank: Option<&str>,
    ) -> Result<Vec<(i64, String, Option<String>, Option<String>)>, ApiError> {
        let mut url = format!(
            "{}/taxa?q={}&per_page=20",
            INATURALIST_BASE_URL,
            urlencoding::encode(query)
        );

        if let Some(r) = rank {
            url.push_str(&format!("&rank={}", r));
        }

        let response = client.get("inaturalist", &url).await?;
        let data: TaxaResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.results.into_iter()
            .map(|taxon| {
                let thumb = taxon.default_photo.and_then(|p| p.square_url);
                (taxon.id, taxon.name, taxon.preferred_common_name, thumb)
            })
            .collect();

        Ok(results)
    }

    fn get_original_url(url: &str) -> String {
        // Convert thumbnail URL to original
        // iNaturalist URLs: https://inaturalist-open-data.s3.amazonaws.com/photos/123456/square.jpg
        // Original: https://inaturalist-open-data.s3.amazonaws.com/photos/123456/original.jpg
        url.replace("/square.", "/original.")
           .replace("/small.", "/original.")
           .replace("/medium.", "/original.")
           .replace("/large.", "/original.")
    }

    fn get_thumb_url(url: &str) -> String {
        // Convert to small/square thumbnail
        url.replace("/original.", "/square.")
           .replace("/large.", "/square.")
           .replace("/medium.", "/square.")
    }
}
