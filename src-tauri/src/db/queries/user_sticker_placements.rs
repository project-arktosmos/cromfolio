use rusqlite::{params, Connection};
use crate::models::UserStickerPlacement;

/// Get all sticker placements for a collection
pub fn get_by_collection_id(conn: &Connection, collection_id: &str) -> Result<Vec<UserStickerPlacement>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, collection_id, placed_at
             FROM _user_sticker_placements
             WHERE collection_id = ?1
             ORDER BY placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_placement(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all placed sticker IDs (globally)
pub fn get_all_placed_sticker_ids(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT sticker_id FROM _user_sticker_placements")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get placed sticker IDs for a specific collection
pub fn get_placed_sticker_ids_for_collection(conn: &Connection, collection_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sticker_id FROM _user_sticker_placements WHERE collection_id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Check if a sticker is placed anywhere
pub fn is_sticker_placed(conn: &Connection, sticker_id: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM _user_sticker_placements WHERE sticker_id = ?1",
            params![sticker_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Get the number of times a sticker is placed globally (across all collections)
pub fn get_placement_count(conn: &Connection, sticker_id: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM _user_sticker_placements WHERE sticker_id = ?1",
        params![sticker_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Get placement counts for all stickers (sticker_id -> count)
/// Returns only stickers that have at least one placement
pub fn get_all_placement_counts(conn: &Connection) -> Result<Vec<(String, i64)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sticker_id, COUNT(*) as cnt
             FROM _user_sticker_placements
             GROUP BY sticker_id"
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get placement by sticker and collection
pub fn get_by_sticker_collection(conn: &Connection, sticker_id: &str, collection_id: &str) -> Result<Option<UserStickerPlacement>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, sticker_id, collection_id, placed_at
             FROM _user_sticker_placements
             WHERE sticker_id = ?1 AND collection_id = ?2",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![sticker_id, collection_id], |row| Ok(row_to_placement(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Place a sticker in a collection (create placement)
pub fn create(conn: &Connection, placement: &UserStickerPlacement) -> Result<UserStickerPlacement, String> {
    let id = if placement.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        placement.id.clone()
    };

    let placed_at = if placement.placed_at.is_empty() {
        chrono_now()
    } else {
        placement.placed_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_sticker_placements (id, sticker_id, collection_id, placed_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            id,
            placement.sticker_id,
            placement.collection_id,
            placed_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserStickerPlacement {
        id,
        placed_at,
        ..placement.clone()
    })
}

/// Unstick a sticker from a collection
pub fn delete_by_sticker_collection(conn: &Connection, sticker_id: &str, collection_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute(
            "DELETE FROM _user_sticker_placements WHERE sticker_id = ?1 AND collection_id = ?2",
            params![sticker_id, collection_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all placements for a collection
pub fn delete_by_collection_id(conn: &Connection, collection_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_sticker_placements WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all sticker placements
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_sticker_placements", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_placement(row: &rusqlite::Row) -> UserStickerPlacement {
    UserStickerPlacement {
        id: row.get(0).unwrap_or_default(),
        sticker_id: row.get(1).unwrap_or_default(),
        collection_id: row.get(2).unwrap_or_default(),
        placed_at: row.get(3).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
