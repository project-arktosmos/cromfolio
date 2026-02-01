use rusqlite::{params, Connection};
use crate::models::UserSticker;

/// Get all user-owned stickers
pub fn get_all(conn: &Connection) -> Result<Vec<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, acquired_at
             FROM _user_stickers
             ORDER BY acquired_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_sticker(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all user-owned stickers for a specific source
pub fn get_by_source_id(conn: &Connection, source_id: &str) -> Result<Vec<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, acquired_at
             FROM _user_stickers
             WHERE source_id = ?1
             ORDER BY acquired_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source_id], |row| Ok(row_to_user_sticker(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a specific user sticker by ID
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, acquired_at
             FROM _user_stickers
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_sticker(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Check if user owns a specific sticker (by sticker_id)
pub fn owns_sticker(conn: &Connection, sticker_id: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM _user_stickers WHERE sticker_id = ?1",
            params![sticker_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Get the number of copies of a specific sticker the user owns
pub fn get_copy_count(conn: &Connection, sticker_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM _user_stickers WHERE sticker_id = ?1",
        params![sticker_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Get count of unique stickers owned for a specific source
pub fn get_unique_count_by_source(conn: &Connection, source_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(DISTINCT sticker_id) FROM _user_stickers WHERE source_id = ?1",
        params![source_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Get all unique sticker IDs owned by the user
pub fn get_owned_sticker_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT sticker_id FROM _user_stickers")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Create a new user sticker (acquire a sticker)
pub fn create(conn: &Connection, user_sticker: &UserSticker) -> Result<UserSticker, String> {
    let id = if user_sticker.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        user_sticker.id.clone()
    };

    let acquired_at = if user_sticker.acquired_at.is_empty() {
        chrono_now()
    } else {
        user_sticker.acquired_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_stickers (id, sticker_id, source_id, acquired_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            id,
            user_sticker.sticker_id,
            user_sticker.source_id,
            acquired_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserSticker {
        id,
        acquired_at,
        ..user_sticker.clone()
    })
}

/// Delete a user sticker by ID
pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_stickers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete a user sticker by sticker_id (removes one copy)
pub fn delete_by_sticker_id(conn: &Connection, sticker_id: &str) -> Result<bool, String> {
    // Delete only one row (the first match)
    let rows_affected = conn
        .execute(
            "DELETE FROM _user_stickers WHERE id = (
                SELECT id FROM _user_stickers WHERE sticker_id = ?1 LIMIT 1
            )",
            params![sticker_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all user stickers for a specific source
pub fn delete_by_source_id(conn: &Connection, source_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_stickers WHERE source_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all user stickers (clear all owned)
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_stickers", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_sticker(row: &rusqlite::Row) -> UserSticker {
    UserSticker {
        id: row.get(0).unwrap_or_default(),
        sticker_id: row.get(1).unwrap_or_default(),
        source_id: row.get(2).unwrap_or_default(),
        acquired_at: row.get(3).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
