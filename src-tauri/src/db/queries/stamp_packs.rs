use rusqlite::{params, Connection};
use crate::models::StampPack;

pub fn get_all(conn: &Connection) -> Result<Vec<StampPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at
             FROM stamp_packs
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_stamp_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_source(conn: &Connection, source: &str) -> Result<Vec<StampPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at
             FROM stamp_packs
             WHERE source = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source], |row| Ok(row_to_stamp_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<StampPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at
             FROM stamp_packs
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_stamp_pack(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, pack: &StampPack) -> Result<StampPack, String> {
    let id = if pack.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        pack.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO stamp_packs (
            id, source, name, author, tray_image, pack_file, sticker_count, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            pack.source,
            pack.name,
            pack.author,
            pack.tray_image,
            pack.pack_file,
            pack.sticker_count,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(StampPack {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..pack.clone()
    })
}

pub fn update(conn: &Connection, pack: &StampPack) -> Result<StampPack, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE stamp_packs SET
            source = ?2, name = ?3, author = ?4, tray_image = ?5, pack_file = ?6, sticker_count = ?7, updated_at = ?8
         WHERE id = ?1",
        params![
            pack.id,
            pack.source,
            pack.name,
            pack.author,
            pack.tray_image,
            pack.pack_file,
            pack.sticker_count,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(StampPack {
        updated_at: now,
        ..pack.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM stamp_packs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_stamp_pack(row: &rusqlite::Row) -> StampPack {
    StampPack {
        id: row.get(0).unwrap_or_default(),
        source: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        author: row.get(3).unwrap_or_default(),
        tray_image: row.get(4).unwrap_or(None),
        pack_file: row.get(5).unwrap_or(None),
        sticker_count: row.get(6).unwrap_or(0),
        created_at: row.get(7).unwrap_or_default(),
        updated_at: row.get(8).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
