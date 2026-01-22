use librqbit::{AddTorrent, AddTorrentOptions, Session, SessionOptions};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Managed torrent handle wrapper for tracking individual torrents
pub struct ManagedTorrent {
    pub id: String,
    pub handle_id: usize,
    pub info_hash: String,
    pub name: String,
    pub source: String,
    pub added_at: String,
}

/// State manager for the torrent client
/// Uses librqbit Session for BitTorrent operations
pub struct TorrentManagerState {
    session: Arc<RwLock<Option<Session>>>,
    download_dir: PathBuf,
    /// Map of our internal torrent ID to managed torrent info
    torrents: Arc<RwLock<HashMap<String, ManagedTorrent>>>,
}

impl TorrentManagerState {
    /// Create a new torrent manager with the specified download directory
    pub fn new(download_dir: PathBuf) -> Self {
        Self {
            session: Arc::new(RwLock::new(None)),
            download_dir,
            torrents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get or initialize the librqbit session
    pub async fn get_or_init_session(&self) -> Result<Session, String> {
        let mut session_guard = self.session.write().await;

        if session_guard.is_none() {
            log::info!(
                "Initializing torrent session with download dir: {:?}",
                self.download_dir
            );

            // Ensure download directory exists
            std::fs::create_dir_all(&self.download_dir)
                .map_err(|e| format!("Failed to create download directory: {}", e))?;

            let options = SessionOptions {
                disable_dht: false,
                disable_dht_persistence: false,
                dht_config: None,
                persistence: None,
                listen_port_range: Some(6881..6889),
                enable_upnp_port_forwarding: true,
                ..Default::default()
            };

            let session = Session::new_with_opts(self.download_dir.clone(), options)
                .await
                .map_err(|e| format!("Failed to initialize torrent session: {}", e))?;

            *session_guard = Some(session);
        }

        Ok(session_guard.as_ref().unwrap().clone())
    }

    /// Get the download directory path
    pub fn download_dir(&self) -> &PathBuf {
        &self.download_dir
    }

    /// Get the torrents map for tracking
    pub fn torrents(&self) -> &Arc<RwLock<HashMap<String, ManagedTorrent>>> {
        &self.torrents
    }

    /// Add a torrent from magnet URI or torrent file bytes
    pub async fn add_torrent(
        &self,
        source: &str,
        custom_download_dir: Option<PathBuf>,
    ) -> Result<(usize, String, String, u64, Vec<(usize, String, u64)>), String> {
        let session = self.get_or_init_session().await?;

        let add_torrent = if source.starts_with("magnet:") {
            AddTorrent::from_url(source)
        } else {
            // Assume it's a file path
            let bytes = std::fs::read(source)
                .map_err(|e| format!("Failed to read torrent file: {}", e))?;
            AddTorrent::from_bytes(bytes)
        };

        let options = AddTorrentOptions {
            output_folder: custom_download_dir,
            ..Default::default()
        };

        let handle = session
            .add_torrent(add_torrent, Some(options))
            .await
            .map_err(|e| format!("Failed to add torrent: {}", e))?
            .into_handle()
            .await
            .map_err(|e| format!("Failed to get torrent handle: {}", e))?;

        let handle_id = handle.id();
        let info_hash = handle.info_hash().to_string();

        // Get torrent info
        let info = handle.info();
        let name = info
            .name
            .as_ref()
            .map(|n| n.to_string())
            .unwrap_or_else(|| info_hash.clone());

        let total_bytes = info.iter_file_lengths().map(|l| l as u64).sum();

        let files: Vec<(usize, String, u64)> = info
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
                        (idx, path_str, len as u64)
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok((handle_id, info_hash, name, total_bytes, files))
    }

    /// Get session for stats queries
    pub async fn get_session(&self) -> Option<Session> {
        self.session.read().await.clone()
    }
}
