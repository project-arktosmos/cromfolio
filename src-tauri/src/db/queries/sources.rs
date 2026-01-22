use rusqlite::{params, Connection};
use crate::models::Source;

pub fn get_all(conn: &Connection) -> Result<Vec<Source>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, source_type, external_id, external_id_type, created_at
             FROM sources
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_source(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_album_id(conn: &Connection, album_id: &str) -> Result<Vec<Source>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, source_type, external_id, external_id_type, created_at
             FROM sources
             WHERE album_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![album_id], |row| Ok(row_to_source(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_external_id(
    conn: &Connection,
    external_id_type: &str,
    external_id: &str,
) -> Result<Option<Source>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, source_type, external_id, external_id_type, created_at
             FROM sources
             WHERE external_id_type = ?1 AND external_id = ?2",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![external_id_type, external_id], |row| {
            Ok(row_to_source(row))
        })
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn exists(
    conn: &Connection,
    external_id_type: &str,
    external_id: &str,
) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sources WHERE external_id_type = ?1 AND external_id = ?2",
            params![external_id_type, external_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

pub fn create(conn: &Connection, source: &Source) -> Result<Source, String> {
    let id = if source.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        source.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO sources (id, album_id, source_type, external_id, external_id_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            source.album_id,
            source.source_type,
            source.external_id,
            source.external_id_type,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Source {
        id,
        created_at: now,
        ..source.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM sources WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_album_id(conn: &Connection, album_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM sources WHERE album_id = ?1", params![album_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_source(row: &rusqlite::Row) -> Source {
    Source {
        id: row.get(0).unwrap_or_default(),
        album_id: row.get(1).unwrap_or_default(),
        source_type: row.get(2).unwrap_or_default(),
        external_id: row.get(3).unwrap_or_default(),
        external_id_type: row.get(4).unwrap_or_default(),
        created_at: row.get(5).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
