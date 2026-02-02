use rusqlite::{params, Connection};
use crate::models::UserPlacedStamp;

/// Get all placed stamps for a collection
pub fn get_by_collection_id(conn: &Connection, collection_id: &str) -> Result<Vec<UserPlacedStamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, stamp_id, collection_id, page_index, position_x, position_y, scale, rotation, placed_at
             FROM _user_placed_stamps
             WHERE collection_id = ?1
             ORDER BY placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_placed_stamp(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get placed stamps for a specific page in a collection
pub fn get_by_collection_page(conn: &Connection, collection_id: &str, page_index: i32) -> Result<Vec<UserPlacedStamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, stamp_id, collection_id, page_index, position_x, position_y, scale, rotation, placed_at
             FROM _user_placed_stamps
             WHERE collection_id = ?1 AND page_index = ?2
             ORDER BY placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id, page_index], |row| Ok(row_to_user_placed_stamp(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a single placed stamp by ID
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<UserPlacedStamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, stamp_id, collection_id, page_index, position_x, position_y, scale, rotation, placed_at
             FROM _user_placed_stamps
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_placed_stamp(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Create a new placed stamp
pub fn create(conn: &Connection, placed_stamp: &UserPlacedStamp) -> Result<UserPlacedStamp, String> {
    let id = if placed_stamp.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        placed_stamp.id.clone()
    };

    let placed_at = if placed_stamp.placed_at.is_empty() {
        chrono_now()
    } else {
        placed_stamp.placed_at.clone()
    };

    let scale = if placed_stamp.scale == 0.0 { 1.0 } else { placed_stamp.scale };

    conn.execute(
        "INSERT INTO _user_placed_stamps (id, stamp_id, collection_id, page_index, position_x, position_y, scale, rotation, placed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            placed_stamp.stamp_id,
            placed_stamp.collection_id,
            placed_stamp.page_index,
            placed_stamp.position_x,
            placed_stamp.position_y,
            scale,
            placed_stamp.rotation,
            placed_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserPlacedStamp {
        id,
        placed_at,
        scale,
        ..placed_stamp.clone()
    })
}

/// Update a placed stamp (position, scale, rotation)
pub fn update(conn: &Connection, placed_stamp: &UserPlacedStamp) -> Result<UserPlacedStamp, String> {
    conn.execute(
        "UPDATE _user_placed_stamps
         SET position_x = ?1, position_y = ?2, scale = ?3, rotation = ?4
         WHERE id = ?5",
        params![
            placed_stamp.position_x,
            placed_stamp.position_y,
            placed_stamp.scale,
            placed_stamp.rotation,
            placed_stamp.id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(placed_stamp.clone())
}

/// Delete a placed stamp by ID
pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_stamps WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all placed stamps for a collection
pub fn delete_by_collection_id(conn: &Connection, collection_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_stamps WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all placed stamps
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_stamps", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_placed_stamp(row: &rusqlite::Row) -> UserPlacedStamp {
    UserPlacedStamp {
        id: row.get(0).unwrap_or_default(),
        stamp_id: row.get(1).unwrap_or_default(),
        collection_id: row.get(2).unwrap_or_default(),
        page_index: row.get(3).unwrap_or_default(),
        position_x: row.get(4).unwrap_or_default(),
        position_y: row.get(5).unwrap_or_default(),
        scale: row.get(6).unwrap_or(1.0),
        rotation: row.get(7).unwrap_or_default(),
        placed_at: row.get(8).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
