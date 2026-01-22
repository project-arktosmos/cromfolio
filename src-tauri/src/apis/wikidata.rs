use serde::Deserialize;
use super::client::{ApiClient, ApiError};
use super::types::{AnimalSearchResult, SpeciesResult};

const WIKIDATA_SPARQL_URL: &str = "https://query.wikidata.org/sparql";

#[derive(Debug, Deserialize)]
struct SparqlResponse {
    results: SparqlResults,
}

#[derive(Debug, Deserialize)]
struct SparqlResults {
    bindings: Vec<SparqlBinding>,
}

#[derive(Debug, Deserialize)]
struct SparqlBinding {
    genus: Option<SparqlValue>,
    genusLabel: Option<SparqlValue>,
    commonName: Option<SparqlValue>,
    description: Option<SparqlValue>,
    image: Option<SparqlValue>,
    family: Option<SparqlValue>,
    familyLabel: Option<SparqlValue>,
    // Species-specific fields
    species: Option<SparqlValue>,
    speciesLabel: Option<SparqlValue>,
    speciesEpithet: Option<SparqlValue>,
    speciesImage: Option<SparqlValue>,
}

#[derive(Debug, Deserialize)]
struct SparqlValue {
    value: String,
}

pub struct WikidataApi;

impl WikidataApi {
    /// Search for genera (plural of genus) by name
    pub async fn search_genera(
        client: &ApiClient,
        query: &str,
    ) -> Result<Vec<AnimalSearchResult>, ApiError> {
        let sparql_query = format!(r#"
            SELECT DISTINCT ?genus ?genusLabel ?commonName ?description ?image ?familyLabel WHERE {{
              ?genus wdt:P31 wd:Q16521;
                     wdt:P105 wd:Q34740;
                     rdfs:label ?genusLabel.
              FILTER(LANG(?genusLabel) = "en")
              FILTER(CONTAINS(LCASE(?genusLabel), "{}"))

              OPTIONAL {{ ?genus wdt:P1843 ?commonName. FILTER(LANG(?commonName) = "en") }}
              OPTIONAL {{ ?genus schema:description ?description. FILTER(LANG(?description) = "en") }}
              OPTIONAL {{ ?genus wdt:P18 ?image. }}
              OPTIONAL {{
                ?genus wdt:P171+ ?family.
                ?family wdt:P105 wd:Q35409.
                ?family rdfs:label ?familyLabel.
                FILTER(LANG(?familyLabel) = "en")
              }}
            }}
            LIMIT 20
        "#, query.to_lowercase().replace('"', ""));

        let url = format!("{}?query={}&format=json", WIKIDATA_SPARQL_URL, urlencoding::encode(&sparql_query));

        let response = client.get("wikidata", &url).await?;
        let data: SparqlResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.results.bindings.into_iter()
            .filter_map(|binding| {
                let genus_uri = binding.genus?.value;
                let wikidata_id = genus_uri.split('/').last()?.to_string();
                let genus_name = binding.genusLabel?.value;

                let (image_url, thumb_url) = binding.image
                    .map(|img| {
                        let url = img.value;
                        let thumb = Self::get_commons_thumb(&url, 200);
                        (Some(url), Some(thumb))
                    })
                    .unwrap_or((None, None));

                Some(AnimalSearchResult {
                    wikidata_id,
                    genus_name,
                    common_name: binding.commonName.map(|v| v.value),
                    description: binding.description.map(|v| v.value),
                    image_url,
                    thumb_url,
                    taxonomic_family: binding.familyLabel.map(|v| v.value),
                })
            })
            .collect();

        Ok(results)
    }

    /// Get species within a genus
    pub async fn get_species_in_genus(
        client: &ApiClient,
        genus_wikidata_id: &str,
    ) -> Result<Vec<SpeciesResult>, ApiError> {
        let sparql_query = format!(r#"
            SELECT DISTINCT ?species ?speciesLabel ?speciesEpithet ?commonName ?description ?speciesImage WHERE {{
              ?species wdt:P171 wd:{};
                       wdt:P105 wd:Q7432;
                       rdfs:label ?speciesLabel.
              FILTER(LANG(?speciesLabel) = "en")

              OPTIONAL {{
                ?species wdt:P225 ?speciesEpithet.
              }}
              OPTIONAL {{ ?species wdt:P1843 ?commonName. FILTER(LANG(?commonName) = "en") }}
              OPTIONAL {{ ?species schema:description ?description. FILTER(LANG(?description) = "en") }}
              OPTIONAL {{ ?species wdt:P18 ?speciesImage. }}
            }}
            ORDER BY ?speciesLabel
            LIMIT 100
        "#, genus_wikidata_id);

        let url = format!("{}?query={}&format=json", WIKIDATA_SPARQL_URL, urlencoding::encode(&sparql_query));

        let response = client.get("wikidata", &url).await?;
        let data: SparqlResponse = response.json().await
            .map_err(|e| ApiError::InvalidResponse(e.to_string()))?;

        let results = data.results.bindings.into_iter()
            .filter_map(|binding| {
                let species_uri = binding.species?.value;
                let wikidata_id = species_uri.split('/').last()?.to_string();
                let scientific_name = binding.speciesLabel?.value;

                // Extract species epithet from scientific name if not provided
                let species_epithet = binding.speciesEpithet
                    .map(|v| v.value)
                    .unwrap_or_else(|| {
                        scientific_name.split_whitespace()
                            .nth(1)
                            .unwrap_or(&scientific_name)
                            .to_string()
                    });

                let (image_url, thumb_url) = binding.speciesImage
                    .map(|img| {
                        let url = img.value;
                        let thumb = Self::get_commons_thumb(&url, 200);
                        (Some(url), Some(thumb))
                    })
                    .unwrap_or((None, None));

                Some(SpeciesResult {
                    wikidata_id,
                    scientific_name,
                    species_epithet,
                    common_name: binding.commonName.map(|v| v.value),
                    description: binding.description.map(|v| v.value),
                    image_url,
                    thumb_url,
                })
            })
            .collect();

        Ok(results)
    }

    /// Convert Wikimedia Commons URL to thumbnail URL
    fn get_commons_thumb(url: &str, size: u32) -> String {
        // Commons URLs like: https://commons.wikimedia.org/wiki/Special:FilePath/Filename.jpg
        // Need to convert to: https://commons.wikimedia.org/wiki/Special:FilePath/Filename.jpg?width=SIZE
        if url.contains("Special:FilePath") {
            format!("{}?width={}", url, size)
        } else {
            url.to_string()
        }
    }
}
