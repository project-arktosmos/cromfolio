use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{command, AppHandle, Emitter, State};
use librqbit::api::TorrentIdOrHash;
use librqbit::{Session, TorrentStatsState};

use super::events::{
    TorrentAddedEvent, TorrentFileInfo, TorrentInfo, TorrentProgressEvent, TorrentStatus,
};
use super::state::{ManagedTorrent, TorrentManagerState};

/// Add a torrent from magnet URI or .torrent file path
#[command]
pub async fn add_torrent(
    app: AppHandle,
    source: String,
    download_dir: Option<String>,
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<TorrentAddedEvent, String> {
    log::info!("Adding torrent from source: {}", source);

    let custom_dir = download_dir.map(PathBuf::from);

    let (torrent_id, handle_id, info_hash, name, total_bytes, files) = torrent_state
        .add_torrent(&source, custom_dir)
        .await?;

    let file_infos: Vec<TorrentFileInfo> = files
        .into_iter()
        .map(|(index, path, size)| TorrentFileInfo { index, path, size })
        .collect();

    let event = TorrentAddedEvent {
        torrent_id: torrent_id.clone(),
        info_hash: info_hash.clone(),
        name: name.clone(),
        total_bytes,
        files: file_infos.clone(),
    };

    // Emit added event
    let _ = app.emit("torrent_added", &event);

    // Spawn progress monitoring task
    let state_clone = TorrentManagerState::new(torrent_state.download_dir().clone());
    // Copy the session reference
    {
        let session = torrent_state.get_session().await;
        if let Some(s) = session {
            state_clone.set_session(s).await;
        }
    }

    spawn_progress_monitor(
        app,
        state_clone,
        torrent_id.clone(),
        handle_id,
        info_hash,
        name,
    );

    Ok(event)
}

/// List all tracked torrents with their current status
#[command]
pub async fn list_torrents(
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<Vec<TorrentInfo>, String> {
    let torrents = torrent_state.torrents().read().await;
    let session = torrent_state.get_session().await;

    let mut result = Vec::new();

    for managed in torrents.values() {
        let torrent_info = get_torrent_info(managed, &session, torrent_state.download_dir());
        result.push(torrent_info);
    }

    Ok(result)
}

/// Get information about a single torrent
fn get_torrent_info(
    managed: &ManagedTorrent,
    session: &Option<Arc<Session>>,
    download_dir: &PathBuf,
) -> TorrentInfo {
    let (status, progress, downloaded, total, dl_speed, ul_speed, peers, seeds, eta, files) =
        if let Some(ref session) = session {
            if let Some(handle) = session.get(TorrentIdOrHash::Id(managed.handle_id)) {
                let stats = handle.stats();

                let total_bytes = stats.total_bytes;
                let downloaded_bytes = stats.progress_bytes;
                let progress = if total_bytes > 0 {
                    (downloaded_bytes as f64 / total_bytes as f64).min(1.0)
                } else {
                    0.0
                };

                let status = if stats.finished {
                    TorrentStatus::Completed
                } else if matches!(stats.state, TorrentStatsState::Paused) {
                    TorrentStatus::Paused
                } else if matches!(stats.state, TorrentStatsState::Initializing) {
                    TorrentStatus::Initializing
                } else if matches!(stats.state, TorrentStatsState::Error) {
                    TorrentStatus::Error
                } else if stats.progress_bytes > 0 {
                    TorrentStatus::Downloading
                } else {
                    TorrentStatus::Initializing
                };

                let (dl_speed, ul_speed, peers, seeds, eta) = if let Some(live) = &stats.live {
                    // Speed is in MiB/s, convert to bytes/s
                    let dl = (live.download_speed.mbps * 1024.0 * 1024.0) as u64;
                    let ul = (live.upload_speed.mbps * 1024.0 * 1024.0) as u64;
                    let peer_stats = &live.snapshot.peer_stats;

                    let eta = if dl > 0 && !stats.finished {
                        let remaining = total_bytes.saturating_sub(downloaded_bytes);
                        Some(remaining / dl)
                    } else {
                        None
                    };

                    (dl, ul, (peer_stats.connecting + peer_stats.live) as u32, peer_stats.seen as u32, eta)
                } else {
                    (0, 0, 0, 0, None)
                };

                // Get file info
                let files: Vec<TorrentFileInfo> = handle
                    .with_metadata(|meta| {
                        meta.file_infos
                            .iter()
                            .enumerate()
                            .map(|(idx, fi)| TorrentFileInfo {
                                index: idx,
                                path: fi.relative_filename.to_string_lossy().to_string(),
                                size: fi.len,
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                (
                    status,
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    dl_speed,
                    ul_speed,
                    peers,
                    seeds,
                    eta,
                    files,
                )
            } else {
                (
                    TorrentStatus::Error,
                    0.0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    None,
                    vec![],
                )
            }
        } else {
            (
                TorrentStatus::Pending,
                0.0,
                0,
                0,
                0,
                0,
                0,
                0,
                None,
                vec![],
            )
        };

    TorrentInfo {
        id: managed.id.clone(),
        info_hash: managed.info_hash.clone(),
        name: managed.name.clone(),
        source: managed.source.clone(),
        download_dir: download_dir.to_string_lossy().to_string(),
        status,
        progress,
        downloaded_bytes: downloaded,
        total_bytes: total,
        download_speed: dl_speed,
        upload_speed: ul_speed,
        peers_connected: peers,
        seeds_connected: seeds,
        eta_seconds: eta,
        error_message: None,
        files,
        added_at: managed.added_at.clone(),
        completed_at: None,
    }
}

/// Pause a torrent by ID
#[command]
pub async fn pause_torrent(
    torrent_id: String,
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<bool, String> {
    let handle_id = {
        let torrents = torrent_state.torrents().read().await;
        let managed = torrents
            .get(&torrent_id)
            .ok_or_else(|| format!("Torrent not found: {}", torrent_id))?;
        managed.handle_id
    };

    let session = torrent_state
        .get_session()
        .await
        .ok_or("Session not initialized")?;

    if let Some(handle) = session.get(TorrentIdOrHash::Id(handle_id)) {
        session.pause(&handle).await
            .map_err(|e| format!("Failed to pause torrent: {}", e))?;
        log::info!("Paused torrent: {}", torrent_id);
        Ok(true)
    } else {
        Err(format!("Torrent handle not found: {}", torrent_id))
    }
}

/// Resume a paused torrent by ID
#[command]
pub async fn resume_torrent(
    torrent_id: String,
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<bool, String> {
    let handle_id = {
        let torrents = torrent_state.torrents().read().await;
        let managed = torrents
            .get(&torrent_id)
            .ok_or_else(|| format!("Torrent not found: {}", torrent_id))?;
        managed.handle_id
    };

    let session = torrent_state
        .get_session()
        .await
        .ok_or("Session not initialized")?;

    if let Some(handle) = session.get(TorrentIdOrHash::Id(handle_id)) {
        session.unpause(&handle).await
            .map_err(|e| format!("Failed to resume torrent: {}", e))?;
        log::info!("Resumed torrent: {}", torrent_id);
        Ok(true)
    } else {
        Err(format!("Torrent handle not found: {}", torrent_id))
    }
}

/// Remove a torrent by ID
#[command]
pub async fn remove_torrent(
    torrent_id: String,
    delete_files: bool,
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<bool, String> {
    let handle_id = {
        let torrents = torrent_state.torrents().read().await;
        let managed = torrents
            .get(&torrent_id)
            .ok_or_else(|| format!("Torrent not found: {}", torrent_id))?;
        managed.handle_id
    };

    if let Some(session) = torrent_state.get_session().await {
        session
            .delete(TorrentIdOrHash::Id(handle_id), delete_files)
            .await
            .map_err(|e| format!("Failed to delete torrent: {}", e))?;
    }

    // Remove from tracking
    {
        let mut torrents = torrent_state.torrents().write().await;
        torrents.remove(&torrent_id);
    }

    log::info!(
        "Removed torrent: {} (delete_files={})",
        torrent_id,
        delete_files
    );
    Ok(true)
}

/// Get the download directory path
#[command]
pub fn get_torrent_download_dir(torrent_state: State<'_, TorrentManagerState>) -> String {
    torrent_state.download_dir().to_string_lossy().to_string()
}

/// Spawn a background task to monitor torrent progress and emit events
fn spawn_progress_monitor(
    app: AppHandle,
    state: TorrentManagerState,
    torrent_id: String,
    handle_id: usize,
    info_hash: String,
    name: String,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut consecutive_errors = 0;

        loop {
            interval.tick().await;

            let session = match state.get_session().await {
                Some(s) => s,
                None => {
                    consecutive_errors += 1;
                    if consecutive_errors > 5 {
                        log::error!("Session unavailable, stopping progress monitor");
                        break;
                    }
                    continue;
                }
            };

            let handle = match session.get(TorrentIdOrHash::Id(handle_id)) {
                Some(h) => h,
                None => {
                    log::warn!("Torrent handle {} no longer exists", handle_id);
                    break;
                }
            };

            let stats = handle.stats();

            let total_bytes = stats.total_bytes;
            let downloaded_bytes = stats.progress_bytes;
            let progress = if total_bytes > 0 {
                (downloaded_bytes as f64 / total_bytes as f64).min(1.0)
            } else {
                0.0
            };

            let status = if stats.finished {
                TorrentStatus::Completed
            } else if matches!(stats.state, TorrentStatsState::Paused) {
                TorrentStatus::Paused
            } else if matches!(stats.state, TorrentStatsState::Initializing) {
                TorrentStatus::Initializing
            } else if matches!(stats.state, TorrentStatsState::Error) {
                TorrentStatus::Error
            } else if stats.progress_bytes > 0 {
                TorrentStatus::Downloading
            } else {
                TorrentStatus::Initializing
            };

            let (dl_speed, ul_speed, peers, seeds, eta) = if let Some(live) = &stats.live {
                // Speed is in MiB/s, convert to bytes/s
                let dl = (live.download_speed.mbps * 1024.0 * 1024.0) as u64;
                let ul = (live.upload_speed.mbps * 1024.0 * 1024.0) as u64;
                let peer_stats = &live.snapshot.peer_stats;

                let eta = if dl > 0 && !stats.finished {
                    let remaining = total_bytes.saturating_sub(downloaded_bytes);
                    Some(remaining / dl)
                } else {
                    None
                };

                (dl, ul, (peer_stats.connecting + peer_stats.live) as u32, peer_stats.seen as u32, eta)
            } else {
                (0, 0, 0, 0, None)
            };

            let event = TorrentProgressEvent {
                torrent_id: torrent_id.clone(),
                info_hash: info_hash.clone(),
                name: name.clone(),
                status: status.clone(),
                progress,
                downloaded_bytes,
                total_bytes,
                download_speed: dl_speed,
                upload_speed: ul_speed,
                peers_connected: peers,
                seeds_connected: seeds,
                eta_seconds: eta,
                message: None,
            };

            let _ = app.emit("torrent_progress", &event);

            // Stop monitoring if completed
            if matches!(status, TorrentStatus::Completed) {
                let _ = app.emit("torrent_completed", &event);
                log::info!("Torrent completed: {}", name);
                break;
            }

            consecutive_errors = 0;
        }
    });
}
