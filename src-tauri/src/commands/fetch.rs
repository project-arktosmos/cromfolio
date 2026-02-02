use tauri::{command, AppHandle, Emitter, State};
use std::time::Instant;
use uuid::Uuid;
use futures::future::join_all;

use crate::apis::{
    client::ApiClientState,
    config::ApiConfigState,
    types::*,
    omdb::OmdbApi,
    tmdb::TmdbApi,
    tvmaze::TvMazeApi,
    igdb::IgdbApi,
    sgdb::SgdbApi,
    anilist::AniListApi,
    jikan::JikanApi,
    sports::SportsDbApi,
    wikidata::WikidataApi,
    inaturalist::InaturalistApi,
    musicbrainz::MusicBrainzApi,
};

// ============================================================================
// DETAIL FETCH COMMANDS
// ============================================================================

#[command]
#[allow(non_snake_case)]
pub async fn get_content_details(
    imdbId: String,
    client_state: State<'_, ApiClientState>,
    config_state: State<'_, ApiConfigState>,
) -> Result<ContentDetails, String> {
    let config = config_state.get_config().await;
    let api_key = config.omdb_api_key
        .ok_or_else(|| "OMDB API key not configured".to_string())?;

    OmdbApi::get_by_imdb_id(&client_state.client, &api_key, &imdbId)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// SEARCH COMMANDS
// ============================================================================

#[command]
pub async fn search_movies(
    query: String,
    year: Option<String>,
    client_state: State<'_, ApiClientState>,
    config_state: State<'_, ApiConfigState>,
) -> Result<Vec<MovieSearchResult>, String> {
    let config = config_state.get_config().await;
    let api_key = config.omdb_api_key
        .ok_or_else(|| "OMDB API key not configured".to_string())?;

    OmdbApi::search_movies(&client_state.client, &api_key, &query, year.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_tv(
    query: String,
    year: Option<String>,
    client_state: State<'_, ApiClientState>,
    config_state: State<'_, ApiConfigState>,
) -> Result<Vec<TvSearchResult>, String> {
    let config = config_state.get_config().await;
    let api_key = config.omdb_api_key
        .ok_or_else(|| "OMDB API key not configured".to_string())?;

    OmdbApi::search_tv(&client_state.client, &api_key, &query, year.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_games(
    query: String,
    client_state: State<'_, ApiClientState>,
    config_state: State<'_, ApiConfigState>,
    igdb_state: State<'_, IgdbApi>,
) -> Result<Vec<GameSearchResult>, String> {
    let config = config_state.get_config().await;

    // Try IGDB first if credentials are available
    if let (Some(client_id), Some(client_secret)) = (&config.twitch_client_id, &config.twitch_client_secret) {
        if !client_id.is_empty() && !client_secret.is_empty() {
            return igdb_state.search_games(&client_state.client, client_id, client_secret, &query)
                .await
                .map_err(|e| e.to_string());
        }
    }

    // Fall back to SteamGridDB if IGDB not configured
    if let Some(api_key) = &config.steamgriddb_api_key {
        if !api_key.is_empty() {
            return SgdbApi::search_games(&client_state.client, api_key, &query)
                .await
                .map_err(|e| e.to_string());
        }
    }

    Err("No game search API configured. Set either Twitch credentials (for IGDB) or SteamGridDB API key.".to_string())
}

#[command]
#[allow(non_snake_case)]
pub async fn search_anime(
    query: String,
    page: Option<i32>,
    perPage: Option<i32>,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<AnimeSearchResult>, String> {
    AniListApi::search_anime(
        &client_state.client,
        &query,
        page.unwrap_or(1),
        perPage.unwrap_or(15),
    )
    .await
    .map_err(|e| e.to_string())
}

#[command]
pub async fn search_sports_teams(
    query: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<SportsTeamSearchResult>, String> {
    SportsDbApi::search_teams(&client_state.client, &query, None)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_sports_leagues(
    country: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<SportsLeagueSearchResult>, String> {
    SportsDbApi::get_leagues_by_country(&client_state.client, &country, None)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_animals(
    query: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<AnimalSearchResult>, String> {
    WikidataApi::search_genera(&client_state.client, &query)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// BATCH FETCH COMMAND
// ============================================================================

#[command]
#[allow(non_snake_case)]
pub async fn fetch_source_images(
    app: AppHandle,
    contentType: String,
    externalId: String,
    externalIdType: String,
    sources: Vec<String>,
    client_state: State<'_, ApiClientState>,
    config_state: State<'_, ApiConfigState>,
    igdb_state: State<'_, IgdbApi>,
) -> Result<BatchFetchResult, String> {
    let operation_id = Uuid::new_v4().to_string();
    let start_time = Instant::now();
    let config = config_state.get_config().await;

    let content = ContentType::from_str(&contentType)
        .ok_or_else(|| format!("Invalid content type: {}", contentType))?;

    // Emit initial progress for all sources
    for source in &sources {
        let _ = app.emit("fetch_progress", FetchProgressEvent {
            operation_id: operation_id.clone(),
            source: source.clone(),
            status: FetchStatus::Pending,
            progress: 0.0,
            message: None,
        });
    }

    let mut all_images = Vec::new();
    let mut all_characters = Vec::new();
    let mut completed_sources = Vec::new();
    let mut failed_sources = Vec::new();

    // Fetch based on content type
    match content {
        ContentType::Movie | ContentType::Tv => {
            let is_movie = content == ContentType::Movie;

            // First, resolve TMDB ID if we have IMDB ID
            let tmdb_result = if externalIdType == "imdb" {
                if let Some(api_key) = &config.tmdb_api_key {
                    TmdbApi::find_by_imdb(&client_state.client, api_key, &externalId)
                        .await
                        .ok()
                        .flatten()
                } else {
                    None
                }
            } else if externalIdType == "tmdb" {
                Some(TmdbIdResult {
                    tmdb_id: externalId.parse().unwrap_or(0),
                    media_type: if is_movie { "movie" } else { "tv" }.to_string(),
                })
            } else {
                None
            };

            // Fetch from each requested source
            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: Some(format!("Fetching from {}", source)),
                });

                let result: Result<(Vec<ImageItem>, Vec<CharacterItem>), crate::apis::client::ApiError> = match source.as_str() {
                    "tmdb" => {
                        if let (Some(tmdb), Some(api_key)) = (&tmdb_result, &config.tmdb_api_key) {
                            let images = if is_movie {
                                TmdbApi::get_movie_images(&client_state.client, api_key, tmdb.tmdb_id).await
                            } else {
                                TmdbApi::get_tv_images(&client_state.client, api_key, tmdb.tmdb_id).await
                            };
                            images.map(|imgs| (imgs, Vec::new()))
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("TMDB".to_string()))
                        }
                    }
                    "tvmaze" => {
                        if externalIdType == "imdb" {
                            TvMazeApi::get_images_by_imdb(&client_state.client, &externalId)
                                .await
                                .map(|imgs| (imgs, Vec::new()))
                        } else {
                            Err(crate::apis::client::ApiError::NotFound)
                        }
                    }
                    "credits" => {
                        if let (Some(tmdb), Some(api_key)) = (&tmdb_result, &config.tmdb_api_key) {
                            let chars = if is_movie {
                                TmdbApi::get_movie_credits(&client_state.client, api_key, tmdb.tmdb_id).await
                            } else {
                                TmdbApi::get_tv_credits(&client_state.client, api_key, tmdb.tmdb_id).await
                            };
                            chars.map(|c| (Vec::new(), c))
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("TMDB".to_string()))
                        }
                    }
                    _ => Err(crate::apis::client::ApiError::InvalidResponse(format!("Unknown source: {}", source))),
                };

                match result {
                    Ok((images, characters)) => {
                        all_images.extend(images);
                        all_characters.extend(characters);
                        completed_sources.push(source.clone());
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Success,
                            progress: 1.0,
                            message: None,
                        });
                    }
                    Err(e) => {
                        failed_sources.push(SourceError {
                            source: source.clone(),
                            error: e.to_string(),
                            retryable: e.is_retryable(),
                        });
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Failed,
                            progress: 1.0,
                            message: Some(e.to_string()),
                        });
                    }
                }
            }
        }

        ContentType::Game => {
            let game_id: i64 = externalId.parse()
                .map_err(|_| "Invalid game ID".to_string())?;

            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match source.as_str() {
                    "igdb" => {
                        // IGDB images only work with IGDB IDs
                        if externalIdType != "igdb" {
                            Err(crate::apis::client::ApiError::InvalidResponse(
                                "IGDB images require IGDB ID (search with Twitch credentials)".to_string()
                            ))
                        } else if let (Some(client_id), Some(client_secret)) =
                            (&config.twitch_client_id, &config.twitch_client_secret)
                        {
                            if !client_id.is_empty() && !client_secret.is_empty() {
                                igdb_state.get_game_images(&client_state.client, client_id, client_secret, game_id)
                                    .await
                                    .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                            } else {
                                Err(crate::apis::client::ApiError::MissingApiKey("IGDB".to_string()))
                            }
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("IGDB".to_string()))
                        }
                    }
                    "sgdb" => {
                        if let Some(api_key) = &config.steamgriddb_api_key {
                            if !api_key.is_empty() {
                                // Use SGDB ID directly if that's the source, otherwise search by ID
                                SgdbApi::get_game_images(&client_state.client, api_key, game_id)
                                    .await
                                    .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                            } else {
                                Err(crate::apis::client::ApiError::MissingApiKey("SteamGridDB".to_string()))
                            }
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("SteamGridDB".to_string()))
                        }
                    }
                    _ => Err(crate::apis::client::ApiError::InvalidResponse(format!("Unknown source: {}", source))),
                };

                match result {
                    Ok((images, _)) => {
                        all_images.extend(images);
                        completed_sources.push(source.clone());
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Success,
                            progress: 1.0,
                            message: None,
                        });
                    }
                    Err(e) => {
                        failed_sources.push(SourceError {
                            source: source.clone(),
                            error: e.to_string(),
                            retryable: e.is_retryable(),
                        });
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Failed,
                            progress: 1.0,
                            message: Some(e.to_string()),
                        });
                    }
                }
            }
        }

        ContentType::Anime => {
            let anime_id: i64 = externalId.parse()
                .map_err(|_| "Invalid anime ID".to_string())?;

            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match source.as_str() {
                    "anilist" => {
                        AniListApi::get_anime_images(&client_state.client, anime_id)
                            .await
                            .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                    }
                    "anilist_characters" => {
                        AniListApi::get_characters(&client_state.client, anime_id, 1, 25)
                            .await
                            .map(|chars| (Vec::new(), chars))
                    }
                    "jikan" => {
                        JikanApi::get_anime_pictures(&client_state.client, anime_id)
                            .await
                            .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                    }
                    "jikan_characters" => {
                        JikanApi::get_anime_characters(&client_state.client, anime_id)
                            .await
                            .map(|chars| (Vec::new(), chars))
                    }
                    _ => Err(crate::apis::client::ApiError::InvalidResponse(format!("Unknown source: {}", source))),
                };

                match result {
                    Ok((images, characters)) => {
                        all_images.extend(images);
                        all_characters.extend(characters);
                        completed_sources.push(source.clone());
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Success,
                            progress: 1.0,
                            message: None,
                        });
                    }
                    Err(e) => {
                        failed_sources.push(SourceError {
                            source: source.clone(),
                            error: e.to_string(),
                            retryable: e.is_retryable(),
                        });
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Failed,
                            progress: 1.0,
                            message: Some(e.to_string()),
                        });
                    }
                }
            }
        }

        ContentType::Sports => {
            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match (source.as_str(), externalIdType.as_str()) {
                    ("team", _) | (_, "team") => {
                        SportsDbApi::get_team_images(&client_state.client, &externalId, None)
                            .await
                            .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                    }
                    ("league", _) | (_, "league") => {
                        SportsDbApi::get_league_images(&client_state.client, &externalId, None)
                            .await
                            .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                    }
                    _ => Err(crate::apis::client::ApiError::InvalidResponse(format!("Unknown sports source: {}", source))),
                };

                match result {
                    Ok((images, _)) => {
                        all_images.extend(images);
                        completed_sources.push(source.clone());
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Success,
                            progress: 1.0,
                            message: None,
                        });
                    }
                    Err(e) => {
                        failed_sources.push(SourceError {
                            source: source.clone(),
                            error: e.to_string(),
                            retryable: e.is_retryable(),
                        });
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Failed,
                            progress: 1.0,
                            message: Some(e.to_string()),
                        });
                    }
                }
            }
        }

        ContentType::Animal => {
            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match source.as_str() {
                    "wikidata" => {
                        WikidataApi::get_species_in_genus(&client_state.client, &externalId)
                            .await
                            .map(|species| {
                                let images: Vec<ImageItem> = species.iter()
                                    .filter_map(|s| {
                                        s.image_url.as_ref().map(|url| ImageItem {
                                            url: url.clone(),
                                            thumb_url: s.thumb_url.clone().unwrap_or_else(|| url.clone()),
                                            image_type: "species".to_string(),
                                            source: "wikidata".to_string(),
                                            width: None,
                                            height: None,
                                            vote_average: None,
                                            likes: None,
                                            language: None,
                                        })
                                    })
                                    .collect();
                                (images, Vec::new())
                            })
                    }
                    "inaturalist" => {
                        // externalId should be scientific name for iNaturalist
                        InaturalistApi::get_species_photos(&client_state.client, &externalId, 12)
                            .await
                            .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                    }
                    _ => Err(crate::apis::client::ApiError::InvalidResponse(format!("Unknown source: {}", source))),
                };

                match result {
                    Ok((images, _)) => {
                        all_images.extend(images);
                        completed_sources.push(source.clone());
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Success,
                            progress: 1.0,
                            message: None,
                        });
                    }
                    Err(e) => {
                        failed_sources.push(SourceError {
                            source: source.clone(),
                            error: e.to_string(),
                            retryable: e.is_retryable(),
                        });
                        let _ = app.emit("fetch_progress", FetchProgressEvent {
                            operation_id: operation_id.clone(),
                            source: source.clone(),
                            status: FetchStatus::Failed,
                            progress: 1.0,
                            message: Some(e.to_string()),
                        });
                    }
                }
            }
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    Ok(BatchFetchResult {
        operation_id,
        images: all_images,
        characters: all_characters,
        sources_completed: completed_sources,
        sources_failed: failed_sources,
        total_duration_ms: duration_ms,
    })
}

// ============================================================================
// ADDITIONAL HELPER COMMANDS
// ============================================================================

#[command]
#[allow(non_snake_case)]
pub async fn get_species_in_genus(
    genusWikidataId: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<SpeciesResult>, String> {
    WikidataApi::get_species_in_genus(&client_state.client, &genusWikidataId)
        .await
        .map_err(|e| e.to_string())
}

#[command]
#[allow(non_snake_case)]
pub async fn get_teams_in_league(
    leagueName: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<SportsTeamSearchResult>, String> {
    SportsDbApi::get_teams_in_league(&client_state.client, &leagueName, None)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// API CONFIG COMMANDS
// ============================================================================

#[command]
pub async fn get_api_config(
    config_state: State<'_, ApiConfigState>,
) -> Result<crate::apis::config::ApiConfig, String> {
    Ok(config_state.get_config().await)
}

#[command]
pub async fn update_api_config(
    config: crate::apis::config::ApiConfig,
    config_state: State<'_, ApiConfigState>,
) -> Result<(), String> {
    config_state.update_config(config).await;
    Ok(())
}

// ============================================================================
// LLM COMMANDS
// ============================================================================

use crate::apis::llm::{LlmApi, LlmModel, ChatMessagePayload, LlmChatOptions};

#[command]
#[allow(non_snake_case)]
pub async fn check_llm_server(
    baseUrl: String,
    provider: String,
    client_state: State<'_, ApiClientState>,
) -> Result<bool, String> {
    LlmApi::check_health(&client_state.client, &baseUrl, &provider)
        .await
        .map_err(|e| e.to_string())
}

#[command]
#[allow(non_snake_case)]
pub async fn get_llm_models(
    baseUrl: String,
    provider: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<LlmModel>, String> {
    LlmApi::get_models(&client_state.client, &baseUrl, &provider)
        .await
        .map_err(|e| e.to_string())
}

#[command]
#[allow(non_snake_case)]
pub async fn chat_llm(
    baseUrl: String,
    provider: String,
    model: String,
    messages: Vec<ChatMessagePayload>,
    options: Option<LlmChatOptions>,
    client_state: State<'_, ApiClientState>,
) -> Result<String, String> {
    LlmApi::chat(
        &client_state.client,
        &baseUrl,
        &provider,
        &model,
        &messages,
        &options.unwrap_or_default(),
    )
    .await
    .map_err(|e| e.to_string())
}

/// Default LLM server URLs from environment configuration
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmDefaults {
    pub ollama_base_url: String,
    pub lmstudio_base_url: String,
}

#[command]
pub async fn get_llm_defaults(
    config_state: State<'_, ApiConfigState>,
) -> Result<LlmDefaults, String> {
    let config = config_state.get_config().await;
    Ok(LlmDefaults {
        ollama_base_url: config.ollama_base_url
            .unwrap_or_else(|| "http://192.168.1.69:11434".to_string()),
        lmstudio_base_url: config.lmstudio_base_url
            .unwrap_or_else(|| "http://localhost:1234".to_string()),
    })
}

// ============================================================================
// MUSICBRAINZ COMMANDS
// ============================================================================

#[command]
pub async fn search_musicbrainz_artists(
    query: String,
    limit: Option<i32>,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<MusicBrainzArtistResult>, String> {
    MusicBrainzApi::search_artists(&client_state.client, &query, limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_musicbrainz_releases(
    query: String,
    limit: Option<i32>,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<MusicBrainzReleaseResult>, String> {
    let results = MusicBrainzApi::search_releases(&client_state.client, &query, limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())?;

    if let Some(first) = results.first() {
        eprintln!("[MB Search] Query: '{}', First result: '{}', release_group_mbid: {:?}",
            query, first.title, first.release_group_mbid);
    }

    Ok(results)
}

#[command]
pub async fn search_musicbrainz_recordings(
    query: String,
    limit: Option<i32>,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<MusicBrainzRecordingResult>, String> {
    MusicBrainzApi::search_recordings(&client_state.client, &query, limit.unwrap_or(10))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_musicbrainz_cover_art(
    release_mbid: String,
    release_group_mbid: Option<String>,
    client_state: State<'_, ApiClientState>,
) -> Result<Option<String>, String> {
    eprintln!("[CoverArt] Fetching for release: {}, release_group: {:?}", release_mbid, release_group_mbid);

    // Try release cover art first
    match MusicBrainzApi::get_release_cover_art(&client_state.client, &release_mbid).await {
        Ok(Some(url)) => {
            eprintln!("[CoverArt] Found release cover: {}", url);
            return Ok(Some(url));
        }
        Ok(None) => {
            eprintln!("[CoverArt] No release cover art found");
        }
        Err(e) => {
            eprintln!("[CoverArt] Release cover art error: {}", e);
        }
    }

    // Fall back to release group cover art
    if let Some(rg_mbid) = release_group_mbid {
        eprintln!("[CoverArt] Trying release group: {}", rg_mbid);
        match MusicBrainzApi::get_release_group_cover_art(&client_state.client, &rg_mbid).await {
            Ok(Some(url)) => {
                eprintln!("[CoverArt] Found release group cover: {}", url);
                return Ok(Some(url));
            }
            Ok(None) => {
                eprintln!("[CoverArt] No release group cover art found");
                return Ok(None);
            }
            Err(e) => {
                eprintln!("[CoverArt] Release group cover art error: {}", e);
                return Err(e.to_string());
            }
        }
    }

    eprintln!("[CoverArt] No cover art found (no release group mbid)");
    Ok(None)
}
