use rusqlite::{params, Connection};
use crate::models::UserSticker;

/// Get all user-owned stickers
pub fn get_all(conn: &Connection) -> Result<Vec<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, collection_id, rarity_id, acquired_at
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
pub fn get_by_source_id(conn: &Connection, source_id: i64) -> Result<Vec<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, collection_id, rarity_id, acquired_at
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
pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<UserSticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, source_id, collection_id, rarity_id, acquired_at
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
pub fn owns_sticker(conn: &Connection, sticker_id: i64) -> Result<bool, String> {
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
pub fn get_copy_count(conn: &Connection, sticker_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM _user_stickers WHERE sticker_id = ?1",
        params![sticker_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Get count of unique stickers owned for a specific source
pub fn get_unique_count_by_source(conn: &Connection, source_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(DISTINCT sticker_id) FROM _user_stickers WHERE source_id = ?1",
        params![source_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Get all unique sticker IDs owned by the user
pub fn get_owned_sticker_ids(conn: &Connection) -> Result<Vec<i64>, String> {
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
    let acquired_at = if user_sticker.acquired_at.is_empty() {
        chrono_now()
    } else {
        user_sticker.acquired_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_stickers (sticker_id, source_id, collection_id, rarity_id, acquired_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            user_sticker.sticker_id,
            user_sticker.source_id,
            user_sticker.collection_id,
            user_sticker.rarity_id,
            acquired_at
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(UserSticker {
        id,
        acquired_at,
        ..user_sticker.clone()
    })
}

/// Delete a user sticker by ID
pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_stickers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete a user sticker by sticker_id (removes one copy)
pub fn delete_by_sticker_id(conn: &Connection, sticker_id: i64) -> Result<bool, String> {
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
pub fn delete_by_source_id(conn: &Connection, source_id: i64) -> Result<bool, String> {
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
        collection_id: row.get(3).unwrap_or_default(),
        rarity_id: row.get(4).unwrap_or_default(),
        acquired_at: row.get(5).unwrap_or_default(),
    }
}

/// Get stickers that can be mixed (same sticker_id and rarity_id with count >= 2)
/// Returns tuples of (sticker_id, rarity_id, count)
/// Note: NULL rarity_id is treated as 0 for grouping
pub fn get_mixable_stickers(conn: &Connection) -> Result<Vec<(i64, Option<i64>, i64)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sticker_id, rarity_id, COUNT(*) as cnt
             FROM _user_stickers
             GROUP BY sticker_id, rarity_id
             HAVING cnt >= 2
             ORDER BY sticker_id, rarity_id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get copy count for a specific sticker and rarity combination
/// None rarity_id matches NULL in the database
pub fn get_copy_count_by_rarity(conn: &Connection, sticker_id: i64, rarity_id: Option<i64>) -> Result<i64, String> {
    match rarity_id {
        None => {
            conn.query_row(
                "SELECT COUNT(*) FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id IS NULL",
                params![sticker_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())
        }
        Some(rid) => {
            conn.query_row(
                "SELECT COUNT(*) FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id = ?2",
                params![sticker_id, rid],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())
        }
    }
}

/// Mix two stickers of the same type and rarity to create one of higher rarity
/// Deletes 2 stickers with the given sticker_id and rarity_id, creates 1 with new_rarity_id
/// None current_rarity_id matches stickers with NULL rarity
/// Returns the newly created sticker
pub fn mix_stickers(
    conn: &Connection,
    sticker_id: i64,
    current_rarity_id: Option<i64>,
    new_rarity_id: i64,
    source_id: i64,
) -> Result<UserSticker, String> {
    // First, verify we have at least 2 copies to mix
    let count = get_copy_count_by_rarity(conn, sticker_id, current_rarity_id)?;
    if count < 2 {
        return Err(format!(
            "Not enough copies to mix: have {}, need at least 2",
            count
        ));
    }

    // Delete 2 copies (one at a time to be safe)
    match current_rarity_id {
        None => {
            conn.execute(
                "DELETE FROM _user_stickers WHERE id = (
                    SELECT id FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id IS NULL LIMIT 1
                )",
                params![sticker_id],
            )
            .map_err(|e| e.to_string())?;

            conn.execute(
                "DELETE FROM _user_stickers WHERE id = (
                    SELECT id FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id IS NULL LIMIT 1
                )",
                params![sticker_id],
            )
            .map_err(|e| e.to_string())?;
        }
        Some(rid) => {
            conn.execute(
                "DELETE FROM _user_stickers WHERE id = (
                    SELECT id FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id = ?2 LIMIT 1
                )",
                params![sticker_id, rid],
            )
            .map_err(|e| e.to_string())?;

            conn.execute(
                "DELETE FROM _user_stickers WHERE id = (
                    SELECT id FROM _user_stickers WHERE sticker_id = ?1 AND rarity_id = ?2 LIMIT 1
                )",
                params![sticker_id, rid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Create the new upgraded sticker
    let new_sticker = UserSticker {
        id: 0,
        sticker_id,
        source_id,
        collection_id: None, // Mixed stickers don't have a specific collection origin
        rarity_id: Some(new_rarity_id),
        acquired_at: String::new(),
    };

    create(conn, &new_sticker)
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
