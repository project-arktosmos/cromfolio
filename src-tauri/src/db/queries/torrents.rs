use rusqlite::{params, Connection};
use crate::models::{Torrent, TorrentDbStatus, TorrentFile};

pub fn get_all(conn: &Connection) -> Result<Vec<Torrent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, info_hash, name, source, download_dir, total_bytes, downloaded_bytes,
                    status, error_message, added_at, completed_at, created_at, updated_at
             FROM torrents
             ORDER BY added_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_torrent(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Torrent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, info_hash, name, source, download_dir, total_bytes, downloaded_bytes,
                    status, error_message, added_at, completed_at, created_at, updated_at
             FROM torrents
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_torrent(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_info_hash(conn: &Connection, info_hash: &str) -> Result<Option<Torrent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, info_hash, name, source, download_dir, total_bytes, downloaded_bytes,
                    status, error_message, added_at, completed_at, created_at, updated_at
             FROM torrents
             WHERE info_hash = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![info_hash], |row| Ok(row_to_torrent(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, torrent: &Torrent) -> Result<Torrent, String> {
    let id = if torrent.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        torrent.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO torrents (
            id, info_hash, name, source, download_dir, total_bytes, downloaded_bytes,
            status, error_message, added_at, completed_at, created_at, updated_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
         )",
        params![
            id,
            torrent.info_hash,
            torrent.name,
            torrent.source,
            torrent.download_dir,
            torrent.total_bytes,
            torrent.downloaded_bytes,
            torrent.status.to_string(),
            torrent.error_message,
            torrent.added_at,
            torrent.completed_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Torrent {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..torrent.clone()
    })
}

pub fn update(conn: &Connection, torrent: &Torrent) -> Result<Torrent, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE torrents SET
            info_hash = ?2, name = ?3, source = ?4, download_dir = ?5,
            total_bytes = ?6, downloaded_bytes = ?7, status = ?8,
            error_message = ?9, added_at = ?10, completed_at = ?11, updated_at = ?12
         WHERE id = ?1",
        params![
            torrent.id,
            torrent.info_hash,
            torrent.name,
            torrent.source,
            torrent.download_dir,
            torrent.total_bytes,
            torrent.downloaded_bytes,
            torrent.status.to_string(),
            torrent.error_message,
            torrent.added_at,
            torrent.completed_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Torrent {
        updated_at: now,
        ..torrent.clone()
    })
}

pub fn update_status(
    conn: &Connection,
    id: &str,
    status: TorrentDbStatus,
    downloaded_bytes: i64,
    error_message: Option<String>,
) -> Result<bool, String> {
    let now = chrono_now();
    let completed_at = if matches!(status, TorrentDbStatus::Completed) {
        Some(now.clone())
    } else {
        None
    };

    let rows_affected = conn
        .execute(
            "UPDATE torrents SET
                status = ?2, downloaded_bytes = ?3, error_message = ?4,
                completed_at = COALESCE(?5, completed_at), updated_at = ?6
             WHERE id = ?1",
            params![id, status.to_string(), downloaded_bytes, error_message, completed_at, now],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM torrents WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

// Torrent files queries

pub fn get_files_by_torrent(conn: &Connection, torrent_id: &str) -> Result<Vec<TorrentFile>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, torrent_id, file_index, path, size, created_at
             FROM torrent_files
             WHERE torrent_id = ?1
             ORDER BY file_index ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![torrent_id], |row| Ok(row_to_torrent_file(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create_file(conn: &Connection, file: &TorrentFile) -> Result<TorrentFile, String> {
    let id = if file.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        file.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO torrent_files (id, torrent_id, file_index, path, size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, file.torrent_id, file.file_index, file.path, file.size, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(TorrentFile {
        id,
        created_at: now,
        ..file.clone()
    })
}

pub fn delete_files_by_torrent(conn: &Connection, torrent_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute(
            "DELETE FROM torrent_files WHERE torrent_id = ?1",
            params![torrent_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_torrent(row: &rusqlite::Row) -> Torrent {
    let status_str: String = row.get(7).unwrap_or_else(|_| "pending".to_string());

    Torrent {
        id: row.get(0).unwrap_or_default(),
        info_hash: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        source: row.get(3).unwrap_or_default(),
        download_dir: row.get(4).unwrap_or_default(),
        total_bytes: row.get(5).unwrap_or(0),
        downloaded_bytes: row.get(6).unwrap_or(0),
        status: TorrentDbStatus::from_str(&status_str),
        error_message: row.get(8).unwrap_or(None),
        added_at: row.get(9).unwrap_or_default(),
        completed_at: row.get(10).unwrap_or(None),
        created_at: row.get(11).unwrap_or_default(),
        updated_at: row.get(12).unwrap_or_default(),
    }
}

fn row_to_torrent_file(row: &rusqlite::Row) -> TorrentFile {
    TorrentFile {
        id: row.get(0).unwrap_or_default(),
        torrent_id: row.get(1).unwrap_or_default(),
        file_index: row.get(2).unwrap_or(0),
        path: row.get(3).unwrap_or_default(),
        size: row.get(4).unwrap_or(0),
        created_at: row.get(5).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
