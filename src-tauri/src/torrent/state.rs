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
    session: Arc<RwLock<Option<Arc<Session>>>>,
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

    /// Set the session (used for cloning state for background tasks)
    pub async fn set_session(&self, session: Arc<Session>) {
        let mut guard = self.session.write().await;
        *guard = Some(session);
    }

    /// Get or initialize the librqbit session
    pub async fn get_or_init_session(&self) -> Result<Arc<Session>, String> {
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
    /// Returns (torrent_id, handle_id, info_hash, name, total_bytes, files)
    pub async fn add_torrent(
        &self,
        source: &str,
        custom_download_dir: Option<PathBuf>,
    ) -> Result<(String, usize, String, String, u64, Vec<(usize, String, u64)>), String> {
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
            output_folder: custom_download_dir.map(|p| p.to_string_lossy().to_string()),
            ..Default::default()
        };

        let handle = session
            .add_torrent(add_torrent, Some(options))
            .await
            .map_err(|e| format!("Failed to add torrent: {}", e))?
            .into_handle()
            .ok_or("Failed to get torrent handle: torrent is list-only")?;

        let handle_id: usize = handle.id().into();
        let info_hash = handle.info_hash().as_string();

        // Get torrent info - may need to wait for metadata
        let name = handle.name().unwrap_or_else(|| info_hash.clone());

        // Try to get file info
        let (total_bytes, files) = handle
            .with_metadata(|meta| {
                let total: u64 = meta.file_infos.iter().map(|f| f.len).sum();
                let files: Vec<(usize, String, u64)> = meta
                    .file_infos
                    .iter()
                    .enumerate()
                    .map(|(idx, fi)| {
                        (idx, fi.relative_filename.to_string_lossy().to_string(), fi.len)
                    })
                    .collect();
                (total, files)
            })
            .unwrap_or((0, vec![]));

        // Generate our internal ID
        let torrent_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        // Track the torrent
        {
            let mut torrents = self.torrents.write().await;
            torrents.insert(
                torrent_id.clone(),
                ManagedTorrent {
                    id: torrent_id.clone(),
                    handle_id,
                    info_hash: info_hash.clone(),
                    name: name.clone(),
                    source: source.to_string(),
                    added_at: now,
                },
            );
        }

        Ok((torrent_id, handle_id, info_hash, name, total_bytes, files))
    }

    /// Get session for stats queries
    pub async fn get_session(&self) -> Option<Arc<Session>> {
        self.session.read().await.clone()
    }
}
