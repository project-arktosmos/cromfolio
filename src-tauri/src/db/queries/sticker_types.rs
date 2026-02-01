use rusqlite::{params, Connection};
use crate::models::StickerTypeEntity;

pub fn get_all(conn: &Connection) -> Result<Vec<StickerTypeEntity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at
             FROM sticker_types
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_sticker_type(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<StickerTypeEntity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at
             FROM sticker_types
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_sticker_type(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_category(conn: &Connection, category: &str) -> Result<Vec<StickerTypeEntity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at
             FROM sticker_types
             WHERE category = ?1
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![category], |row| Ok(row_to_sticker_type(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_source_type(conn: &Connection, source_type: &str) -> Result<Vec<StickerTypeEntity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at
             FROM sticker_types
             WHERE source_type = ?1 OR source_type IS NULL
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source_type], |row| Ok(row_to_sticker_type(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, sticker_type: &StickerTypeEntity) -> Result<StickerTypeEntity, String> {
    let id = if sticker_type.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        sticker_type.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO sticker_types (id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            sticker_type.name,
            sticker_type.description,
            sticker_type.category,
            sticker_type.source_type,
            sticker_type.badge_color,
            sticker_type.sort_order,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(StickerTypeEntity {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..sticker_type.clone()
    })
}

pub fn update(conn: &Connection, sticker_type: &StickerTypeEntity) -> Result<StickerTypeEntity, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE sticker_types SET
            name = ?2, description = ?3, category = ?4, source_type = ?5, badge_color = ?6, sort_order = ?7, updated_at = ?8
         WHERE id = ?1",
        params![
            sticker_type.id,
            sticker_type.name,
            sticker_type.description,
            sticker_type.category,
            sticker_type.source_type,
            sticker_type.badge_color,
            sticker_type.sort_order,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(StickerTypeEntity {
        updated_at: now,
        ..sticker_type.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM sticker_types WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_sticker_type(row: &rusqlite::Row) -> StickerTypeEntity {
    StickerTypeEntity {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        description: row.get(2).unwrap_or_default(),
        category: row.get(3).unwrap_or_default(),
        source_type: row.get(4).unwrap_or(None),
        badge_color: row.get(5).unwrap_or_default(),
        sort_order: row.get(6).unwrap_or_default(),
        created_at: row.get(7).unwrap_or_default(),
        updated_at: row.get(8).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
