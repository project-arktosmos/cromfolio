use rusqlite::{params, Connection};
use crate::models::UserSource;

/// Get all user-owned sources
pub fn get_all(conn: &Connection) -> Result<Vec<UserSource>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, acquired_at
             FROM _user_sources
             ORDER BY acquired_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_source(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a specific user source by ID
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<UserSource>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, acquired_at
             FROM _user_sources
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_source(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Check if user owns a specific source
pub fn owns_source(conn: &Connection, source_id: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM _user_sources WHERE source_id = ?1",
            params![source_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Get all owned source IDs
pub fn get_owned_source_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT source_id FROM _user_sources")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Create a new user source (acquire a source)
pub fn create(conn: &Connection, user_source: &UserSource) -> Result<UserSource, String> {
    // Check if already owned
    if owns_source(conn, &user_source.source_id)? {
        return Err("Source already owned".to_string());
    }

    let id = if user_source.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        user_source.id.clone()
    };

    let acquired_at = if user_source.acquired_at.is_empty() {
        chrono_now()
    } else {
        user_source.acquired_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_sources (id, source_id, acquired_at)
         VALUES (?1, ?2, ?3)",
        params![id, user_source.source_id, acquired_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserSource {
        id,
        acquired_at,
        ..user_source.clone()
    })
}

/// Delete a user source by ID
pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_sources WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete a user source by source_id
pub fn delete_by_source_id(conn: &Connection, source_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_sources WHERE source_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all user sources (clear all owned)
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_sources", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_source(row: &rusqlite::Row) -> UserSource {
    UserSource {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        acquired_at: row.get(2).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
