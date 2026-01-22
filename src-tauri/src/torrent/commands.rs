use std::path::PathBuf;
use std::time::Duration;
use tauri::{command, AppHandle, Emitter, State};

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

    let (handle_id, info_hash, name, total_bytes, files) = torrent_state
        .add_torrent(&source, custom_dir)
        .await?;

    // Generate our internal ID
    let torrent_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Track the torrent
    {
        let mut torrents = torrent_state.torrents().write().await;
        torrents.insert(
            torrent_id.clone(),
            ManagedTorrent {
                id: torrent_id.clone(),
                handle_id,
                info_hash: info_hash.clone(),
                name: name.clone(),
                source: source.clone(),
                added_at: now.clone(),
            },
        );
    }

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
    spawn_progress_monitor(
        app,
        torrent_state.inner().clone(),
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
        let (status, progress, downloaded, total, dl_speed, ul_speed, peers, seeds, eta, files) =
            if let Some(ref session) = session {
                if let Some(handle) = session.get(managed.handle_id) {
                    let stats = handle.stats();
                    let info = handle.info();

                    let total_bytes: u64 = info.iter_file_lengths().map(|l| l as u64).sum();
                    let downloaded_bytes = stats.total_bytes_downloaded;
                    let progress = if total_bytes > 0 {
                        (downloaded_bytes as f64 / total_bytes as f64).min(1.0)
                    } else {
                        0.0
                    };

                    let status = if stats.finished {
                        TorrentStatus::Completed
                    } else if handle.is_paused() {
                        TorrentStatus::Paused
                    } else if stats.total_bytes_downloaded > 0 {
                        TorrentStatus::Downloading
                    } else {
                        TorrentStatus::Initializing
                    };

                    let eta = if stats.download_speed.human_readable() > 0.0 && !stats.finished {
                        let remaining = total_bytes.saturating_sub(downloaded_bytes);
                        Some((remaining as f64 / stats.download_speed.human_readable()) as u64)
                    } else {
                        None
                    };

                    let files: Vec<TorrentFileInfo> = info
                        .iter_filenames_and_lengths()
                        .ok()
                        .map(|iter| {
                            iter.enumerate()
                                .map(|(idx, (path, len))| {
                                    let path_str = path
                                        .components()
                                        .map(|c| c.as_os_str().to_string_lossy().to_string())
                                        .collect::<Vec<_>>()
                                        .join("/");
                                    TorrentFileInfo {
                                        index: idx,
                                        path: path_str,
                                        size: len as u64,
                                    }
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    (
                        status,
                        progress,
                        downloaded_bytes,
                        total_bytes,
                        stats.download_speed.human_readable() as u64,
                        stats.upload_speed.human_readable() as u64,
                        stats.live.peers.connecting as u32 + stats.live.peers.live as u32,
                        stats.live.peers.seen as u32,
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

        result.push(TorrentInfo {
            id: managed.id.clone(),
            info_hash: managed.info_hash.clone(),
            name: managed.name.clone(),
            source: managed.source.clone(),
            download_dir: torrent_state.download_dir().to_string_lossy().to_string(),
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
        });
    }

    Ok(result)
}

/// Pause a torrent by ID
#[command]
pub async fn pause_torrent(
    torrent_id: String,
    torrent_state: State<'_, TorrentManagerState>,
) -> Result<bool, String> {
    let torrents = torrent_state.torrents().read().await;
    let managed = torrents
        .get(&torrent_id)
        .ok_or_else(|| format!("Torrent not found: {}", torrent_id))?;

    let session = torrent_state
        .get_session()
        .await
        .ok_or("Session not initialized")?;

    if let Some(handle) = session.get(managed.handle_id) {
        handle.pause();
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
    let torrents = torrent_state.torrents().read().await;
    let managed = torrents
        .get(&torrent_id)
        .ok_or_else(|| format!("Torrent not found: {}", torrent_id))?;

    let session = torrent_state
        .get_session()
        .await
        .ok_or("Session not initialized")?;

    if let Some(handle) = session.get(managed.handle_id) {
        handle
            .start()
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
            .delete(handle_id, delete_files)
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

            let handle = match session.get(handle_id) {
                Some(h) => h,
                None => {
                    log::warn!("Torrent handle {} no longer exists", handle_id);
                    break;
                }
            };

            let stats = handle.stats();
            let info = handle.info();

            let total_bytes: u64 = info.iter_file_lengths().map(|l| l as u64).sum();
            let downloaded_bytes = stats.total_bytes_downloaded;
            let progress = if total_bytes > 0 {
                (downloaded_bytes as f64 / total_bytes as f64).min(1.0)
            } else {
                0.0
            };

            let status = if stats.finished {
                TorrentStatus::Completed
            } else if handle.is_paused() {
                TorrentStatus::Paused
            } else if stats.total_bytes_downloaded > 0 {
                TorrentStatus::Downloading
            } else {
                TorrentStatus::Initializing
            };

            let eta = if stats.download_speed.human_readable() > 0.0 && !stats.finished {
                let remaining = total_bytes.saturating_sub(downloaded_bytes);
                Some((remaining as f64 / stats.download_speed.human_readable()) as u64)
            } else {
                None
            };

            let event = TorrentProgressEvent {
                torrent_id: torrent_id.clone(),
                info_hash: info_hash.clone(),
                name: name.clone(),
                status: status.clone(),
                progress,
                downloaded_bytes,
                total_bytes,
                download_speed: stats.download_speed.human_readable() as u64,
                upload_speed: stats.upload_speed.human_readable() as u64,
                peers_connected: stats.live.peers.connecting as u32 + stats.live.peers.live as u32,
                seeds_connected: stats.live.peers.seen as u32,
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
