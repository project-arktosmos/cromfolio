use rusqlite::{params, Connection};
use crate::models::Sticker;

pub fn get_all(conn: &Connection) -> Result<Vec<Sticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, name, image, sticker_type_id, image_source,
                    width, height, fragment_of, fragment_position, added_at, created_at, updated_at
             FROM stickers
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_sticker(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_source_id(conn: &Connection, source_id: i64) -> Result<Vec<Sticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, name, image, sticker_type_id, image_source,
                    width, height, fragment_of, fragment_position, added_at, created_at, updated_at
             FROM stickers
             WHERE source_id = ?1
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source_id], |row| Ok(row_to_sticker(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Sticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, name, image, sticker_type_id, image_source,
                    width, height, fragment_of, fragment_position, added_at, created_at, updated_at
             FROM stickers
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_sticker(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, sticker: &Sticker) -> Result<Sticker, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO stickers (
            source_id, name, image, sticker_type_id, image_source,
            width, height, fragment_of, fragment_position, added_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            sticker.source_id,
            sticker.name,
            sticker.image,
            sticker.sticker_type_id,
            sticker.image_source,
            sticker.width,
            sticker.height,
            sticker.fragment_of,
            sticker.fragment_position,
            sticker.added_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Sticker {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..sticker.clone()
    })
}

pub fn update(conn: &Connection, sticker: &Sticker) -> Result<Sticker, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE stickers SET
            source_id = ?2, name = ?3, image = ?4, sticker_type_id = ?5, image_source = ?6,
            width = ?7, height = ?8, fragment_of = ?9, fragment_position = ?10, added_at = ?11, updated_at = ?12
         WHERE id = ?1",
        params![
            sticker.id,
            sticker.source_id,
            sticker.name,
            sticker.image,
            sticker.sticker_type_id,
            sticker.image_source,
            sticker.width,
            sticker.height,
            sticker.fragment_of,
            sticker.fragment_position,
            sticker.added_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Sticker {
        updated_at: now,
        ..sticker.clone()
    })
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM stickers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_source_id(conn: &Connection, source_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM stickers WHERE source_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Batch create multiple stickers in a single transaction
/// All stickers are inserted or none (atomic operation)
pub fn create_batch(conn: &Connection, stickers: &[Sticker]) -> Result<Vec<Sticker>, String> {
    let now = chrono_now();
    let mut created_stickers = Vec::with_capacity(stickers.len());

    // Use a savepoint for the batch operation
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    for sticker in stickers {
        let result = conn.execute(
            "INSERT INTO stickers (
                source_id, name, image, sticker_type_id, image_source,
                width, height, fragment_of, fragment_position, added_at, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                sticker.source_id,
                sticker.name,
                sticker.image,
                sticker.sticker_type_id,
                sticker.image_source,
                sticker.width,
                sticker.height,
                sticker.fragment_of,
                sticker.fragment_position,
                sticker.added_at,
                now,
                now
            ],
        );

        match result {
            Ok(_) => {
                let id = conn.last_insert_rowid();
                created_stickers.push(Sticker {
                    id,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                    ..sticker.clone()
                });
            }
            Err(e) => {
                // Rollback on any failure
                let _ = conn.execute("ROLLBACK", []);
                return Err(format!("Failed to insert sticker '{}': {}", sticker.name, e));
            }
        }
    }

    conn.execute("COMMIT", [])
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            format!("Failed to commit transaction: {}", e)
        })?;

    Ok(created_stickers)
}

fn row_to_sticker(row: &rusqlite::Row) -> Sticker {
    Sticker {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        image: row.get(3).unwrap_or_default(),
        sticker_type_id: row.get(4).unwrap_or(None),
        image_source: row.get(5).unwrap_or(None),
        width: row.get(6).unwrap_or(None),
        height: row.get(7).unwrap_or(None),
        fragment_of: row.get(8).unwrap_or(None),
        fragment_position: row.get(9).unwrap_or(None),
        added_at: row.get(10).unwrap_or(None),
        created_at: row.get(11).unwrap_or_default(),
        updated_at: row.get(12).unwrap_or_default(),
        source_name: None,
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
