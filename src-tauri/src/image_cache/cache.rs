use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use url::Url;

use super::models::{BackgroundDownloadProgress, BackgroundDownloadStatus, CacheStats, CachedImage, SourceStats};

/// State for tracking in-flight requests and background downloads
pub struct ImageCacheState {
    pub in_flight: Mutex<HashSet<String>>,
    pub cache_dir: PathBuf,
    pub background_progress: Arc<Mutex<BackgroundDownloadProgress>>,
    pub cancel_flag: Arc<AtomicBool>,
}

impl ImageCacheState {
    pub fn new(cache_dir: PathBuf) -> Self {
        Self {
            in_flight: Mutex::new(HashSet::new()),
            cache_dir,
            background_progress: Arc::new(Mutex::new(BackgroundDownloadProgress::default())),
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Generate a SHA-256 hash of the URL, returning first 16 hex characters
pub fn generate_url_hash(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8]) // 8 bytes = 16 hex chars
}

/// Extract the domain name from a URL for source organization
pub fn extract_domain(url: &str) -> String {
    if let Ok(parsed) = Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            return host.to_lowercase();
        }
    }
    "unknown".to_string()
}

/// Extract file extension from URL, defaulting to .jpg
pub fn get_extension_from_url(url: &str) -> String {
    if let Ok(parsed) = Url::parse(url) {
        let path = parsed.path();
        if let Some(ext_pos) = path.rfind('.') {
            let ext = &path[ext_pos..];
            // Only accept known image extensions
            match ext.to_lowercase().as_str() {
                ".jpg" | ".jpeg" | ".png" | ".gif" | ".webp" | ".avif" => {
                    return ext.to_lowercase();
                }
                _ => {}
            }
        }
    }
    ".jpg".to_string()
}

/// Get the cache directory for images
pub fn get_images_cache_dir(cache_dir: &Path) -> PathBuf {
    cache_dir.join("images")
}

/// Build the local path for a cached image
pub fn build_cache_path(cache_dir: &Path, url: &str) -> PathBuf {
    let hash = generate_url_hash(url);
    let domain = extract_domain(url);
    let ext = get_extension_from_url(url);

    get_images_cache_dir(cache_dir)
        .join(&domain)
        .join(format!("{}{}", hash, ext))
}

/// Check if an image is already cached
pub fn is_cached(cache_dir: &Path, url: &str) -> Option<PathBuf> {
    let path = build_cache_path(cache_dir, url);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Fetch an image from URL and save to disk
pub fn fetch_and_save(url: &str, cache_dir: &Path) -> Result<CachedImage, String> {
    let path = build_cache_path(cache_dir, url);

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;
    }

    // Fetch the image
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?
        .get(url)
        .header("User-Agent", "Synaxis/1.0")
        .send()
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response: {}", e))?;
    let file_size = bytes.len() as u64;

    // Save to disk
    fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;

    let hash = generate_url_hash(url);
    let domain = extract_domain(url);
    let cached_at = chrono::Utc::now().timestamp_millis();

    Ok(CachedImage {
        url_hash: hash,
        original_url: url.to_string(),
        local_path: path.to_string_lossy().to_string(),
        source: domain,
        cached_at,
        file_size,
    })
}

/// Convert a local filesystem path to a string for the frontend
/// The frontend will use convertFileSrc to convert this to an asset:// URL
pub fn path_to_asset_url(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

/// Calculate cache statistics by scanning the cache directory
pub fn calculate_stats(cache_dir: &Path) -> CacheStats {
    let mut stats = CacheStats::default();
    let images_dir = get_images_cache_dir(cache_dir);

    if !images_dir.exists() {
        return stats;
    }

    // Scan all subdirectories (each represents a domain/source)
    if let Ok(entries) = fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if !entry_path.is_dir() {
                continue;
            }

            let source_name = entry_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let mut source_stats = SourceStats::default();

            if let Ok(files) = fs::read_dir(&entry_path) {
                for file in files.flatten() {
                    if let Ok(metadata) = file.metadata() {
                        if metadata.is_file() {
                            source_stats.count += 1;
                            source_stats.size_bytes += metadata.len();
                        }
                    }
                }
            }

            stats.total_images += source_stats.count;
            stats.total_size_bytes += source_stats.size_bytes;

            if source_stats.count > 0 {
                stats.by_source.insert(source_name, source_stats);
            }
        }
    }

    stats
}

/// Clear cached images, optionally filtering by source (domain)
pub fn clear_cache(cache_dir: &Path, source: Option<&str>) -> Result<usize, String> {
    let images_dir = get_images_cache_dir(cache_dir);

    if !images_dir.exists() {
        return Ok(0);
    }

    let mut deleted = 0;

    match source {
        Some(src) => {
            // Clear specific source directory
            let source_dir = images_dir.join(src);
            if source_dir.exists() {
                if let Ok(entries) = fs::read_dir(&source_dir) {
                    for entry in entries.flatten() {
                        if entry.path().is_file() {
                            if fs::remove_file(entry.path()).is_ok() {
                                deleted += 1;
                            }
                        }
                    }
                }
            }
        }
        None => {
            // Clear all source directories
            if let Ok(dirs) = fs::read_dir(&images_dir) {
                for dir_entry in dirs.flatten() {
                    let dir_path = dir_entry.path();
                    if dir_path.is_dir() {
                        if let Ok(files) = fs::read_dir(&dir_path) {
                            for file in files.flatten() {
                                if file.path().is_file() {
                                    if fs::remove_file(file.path()).is_ok() {
                                        deleted += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_hash() {
        let url = "https://example.com/image.jpg";
        let hash = generate_url_hash(url);
        assert_eq!(hash.len(), 16);

        // Same URL should produce same hash
        let hash2 = generate_url_hash(url);
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_extract_domain() {
        assert_eq!(
            extract_domain("https://example.com/path/image.png"),
            "example.com"
        );
        assert_eq!(
            extract_domain("https://cdn.example.org/images/test.jpg"),
            "cdn.example.org"
        );
        assert_eq!(
            extract_domain("https://SUB.DOMAIN.COM/file"),
            "sub.domain.com"
        );
        assert_eq!(extract_domain("invalid-url"), "unknown");
    }

    #[test]
    fn test_get_extension() {
        assert_eq!(
            get_extension_from_url("https://example.com/image.jpg"),
            ".jpg"
        );
        assert_eq!(
            get_extension_from_url("https://example.com/image.PNG"),
            ".png"
        );
        assert_eq!(
            get_extension_from_url("https://example.com/image.webp"),
            ".webp"
        );
        assert_eq!(
            get_extension_from_url("https://example.com/image"),
            ".jpg"
        ); // default
    }
}
