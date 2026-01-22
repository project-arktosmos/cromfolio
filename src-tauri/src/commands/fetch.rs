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
    fanart::FanartApi,
    tvmaze::TvMazeApi,
    igdb::IgdbApi,
    sgdb::SgdbApi,
    anilist::AniListApi,
    jikan::JikanApi,
    sports::SportsDbApi,
    wikidata::WikidataApi,
    inaturalist::InaturalistApi,
    musicbrainz::MusicBrainzApi,
    openlibrary::OpenLibraryApi,
};

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
    let client_id = config.twitch_client_id
        .ok_or_else(|| "Twitch Client ID not configured".to_string())?;
    let client_secret = config.twitch_client_secret
        .ok_or_else(|| "Twitch Client Secret not configured".to_string())?;

    igdb_state.search_games(&client_state.client, &client_id, &client_secret, &query)
        .await
        .map_err(|e| e.to_string())
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

#[command]
pub async fn search_music_artists(
    query: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<MusicArtistSearchResult>, String> {
    MusicBrainzApi::search_artists(&client_state.client, &query)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_book_authors(
    query: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<BookAuthorSearchResult>, String> {
    OpenLibraryApi::search_authors(&client_state.client, &query)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn search_book_works(
    query: String,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<BookWorkSearchResult>, String> {
    OpenLibraryApi::search_works(&client_state.client, &query)
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
                    "fanart" => {
                        if let (Some(tmdb), Some(api_key)) = (&tmdb_result, &config.fanart_api_key) {
                            let images = if is_movie {
                                FanartApi::get_movie_images(&client_state.client, api_key, tmdb.tmdb_id).await
                            } else {
                                // For TV, Fanart uses TVDB ID, but we can try with TMDB
                                FanartApi::get_tv_images(&client_state.client, api_key, tmdb.tmdb_id).await
                            };
                            images.map(|imgs| (imgs, Vec::new()))
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("Fanart".to_string()))
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
                        if let (Some(client_id), Some(client_secret)) =
                            (&config.twitch_client_id, &config.twitch_client_secret)
                        {
                            igdb_state.get_game_images(&client_state.client, client_id, client_secret, game_id)
                                .await
                                .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("IGDB".to_string()))
                        }
                    }
                    "sgdb" => {
                        if let Some(api_key) = &config.steamgriddb_api_key {
                            SgdbApi::get_game_images(&client_state.client, api_key, game_id)
                                .await
                                .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
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

        ContentType::Music => {
            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match source.as_str() {
                    "musicbrainz" => {
                        MusicBrainzApi::get_artist_releases(&client_state.client, &externalId, true)
                            .await
                            .map(|releases| {
                                let images: Vec<ImageItem> = releases.iter()
                                    .filter_map(|r| {
                                        r.cover_url.as_ref().map(|url| ImageItem {
                                            url: url.clone(),
                                            thumb_url: r.thumb_url.clone().unwrap_or_else(|| url.clone()),
                                            image_type: r.release_type.clone().unwrap_or_else(|| "album".to_string()),
                                            source: "musicbrainz".to_string(),
                                            width: None,
                                            height: None,
                                        })
                                    })
                                    .collect();
                                (images, Vec::new())
                            })
                    }
                    "fanart" => {
                        if let Some(api_key) = &config.fanart_api_key {
                            FanartApi::get_music_images(&client_state.client, api_key, &externalId)
                                .await
                                .map(|imgs| (imgs, Vec::<CharacterItem>::new()))
                        } else {
                            Err(crate::apis::client::ApiError::MissingApiKey("Fanart".to_string()))
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

        ContentType::Book => {
            for source in &sources {
                let _ = app.emit("fetch_progress", FetchProgressEvent {
                    operation_id: operation_id.clone(),
                    source: source.clone(),
                    status: FetchStatus::Fetching,
                    progress: 0.5,
                    message: None,
                });

                let result = match (source.as_str(), externalIdType.as_str()) {
                    ("author_works", _) | (_, "author") => {
                        OpenLibraryApi::get_author_works(&client_state.client, &externalId, 50)
                            .await
                            .map(|works| {
                                let images: Vec<ImageItem> = works.iter()
                                    .filter_map(|w| {
                                        w.cover_url.as_ref().map(|url| ImageItem {
                                            url: url.clone(),
                                            thumb_url: url.replace("-L.jpg", "-M.jpg"),
                                            image_type: "cover".to_string(),
                                            source: "openlibrary".to_string(),
                                            width: None,
                                            height: None,
                                        })
                                    })
                                    .collect();
                                (images, Vec::new())
                            })
                    }
                    ("work_covers", _) | (_, "work") => {
                        OpenLibraryApi::get_work_covers(&client_state.client, &externalId)
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
pub async fn get_artist_releases(
    artistId: String,
    includeCovers: bool,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<MusicReleaseResult>, String> {
    MusicBrainzApi::get_artist_releases(&client_state.client, &artistId, includeCovers)
        .await
        .map_err(|e| e.to_string())
}

#[command]
#[allow(non_snake_case)]
pub async fn get_author_works(
    authorKey: String,
    limit: Option<i32>,
    client_state: State<'_, ApiClientState>,
) -> Result<Vec<BookWorkSearchResult>, String> {
    OpenLibraryApi::get_author_works(&client_state.client, &authorKey, limit.unwrap_or(50))
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
