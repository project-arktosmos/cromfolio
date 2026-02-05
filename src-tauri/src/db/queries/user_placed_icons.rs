use rusqlite::{params, Connection};
use crate::models::UserPlacedIcon;

/// Get all placed icons for a collection
pub fn get_by_collection_id(conn: &Connection, collection_id: i64) -> Result<Vec<UserPlacedIcon>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, icon_path, collection_id, page_index, position_x, position_y,
                    scale, rotation, color, placed_at
             FROM _user_placed_icons
             WHERE collection_id = ?1
             ORDER BY placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_placed_icon(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get placed icons for a specific page in a collection
pub fn get_by_collection_page(conn: &Connection, collection_id: i64, page_index: i32) -> Result<Vec<UserPlacedIcon>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, icon_path, collection_id, page_index, position_x, position_y,
                    scale, rotation, color, placed_at
             FROM _user_placed_icons
             WHERE collection_id = ?1 AND page_index = ?2
             ORDER BY placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id, page_index], |row| Ok(row_to_user_placed_icon(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a single placed icon by ID
pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<UserPlacedIcon>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, icon_path, collection_id, page_index, position_x, position_y,
                    scale, rotation, color, placed_at
             FROM _user_placed_icons
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_placed_icon(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Create a new placed icon
pub fn create(conn: &Connection, placed_icon: &UserPlacedIcon) -> Result<UserPlacedIcon, String> {
    let placed_at = if placed_icon.placed_at.is_empty() {
        chrono_now()
    } else {
        placed_icon.placed_at.clone()
    };

    let scale = if placed_icon.scale == 0.0 { 1.0 } else { placed_icon.scale };
    let color = if placed_icon.color.is_empty() { "#000000".to_string() } else { placed_icon.color.clone() };

    conn.execute(
        "INSERT INTO _user_placed_icons (icon_path, collection_id, page_index,
         position_x, position_y, scale, rotation, color, placed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            placed_icon.icon_path,
            placed_icon.collection_id,
            placed_icon.page_index,
            placed_icon.position_x,
            placed_icon.position_y,
            scale,
            placed_icon.rotation,
            color,
            placed_at
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(UserPlacedIcon {
        id,
        placed_at,
        scale,
        color,
        ..placed_icon.clone()
    })
}

/// Update a placed icon (position, scale, rotation, color)
pub fn update(conn: &Connection, placed_icon: &UserPlacedIcon) -> Result<UserPlacedIcon, String> {
    conn.execute(
        "UPDATE _user_placed_icons
         SET position_x = ?1, position_y = ?2, scale = ?3, rotation = ?4, color = ?5
         WHERE id = ?6",
        params![
            placed_icon.position_x,
            placed_icon.position_y,
            placed_icon.scale,
            placed_icon.rotation,
            placed_icon.color,
            placed_icon.id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(placed_icon.clone())
}

/// Delete a placed icon by ID
pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_icons WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all placed icons for a collection
pub fn delete_by_collection_id(conn: &Connection, collection_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_icons WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all placed icons
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_placed_icons", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_placed_icon(row: &rusqlite::Row) -> UserPlacedIcon {
    UserPlacedIcon {
        id: row.get(0).unwrap_or_default(),
        icon_path: row.get(1).unwrap_or_default(),
        collection_id: row.get(2).unwrap_or_default(),
        page_index: row.get(3).unwrap_or_default(),
        position_x: row.get(4).unwrap_or_default(),
        position_y: row.get(5).unwrap_or_default(),
        scale: row.get(6).unwrap_or(1.0),
        rotation: row.get(7).unwrap_or_default(),
        color: row.get(8).unwrap_or_else(|_| "#000000".to_string()),
        placed_at: row.get(9).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
