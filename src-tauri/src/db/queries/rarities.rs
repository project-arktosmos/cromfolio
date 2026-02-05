use rusqlite::{params, Connection};
use crate::models::Rarity;

pub fn get_all(conn: &Connection) -> Result<Vec<Rarity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, color_from, color_to, sort_order, created_at, updated_at
             FROM rarities
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_rarity(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Rarity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, color_from, color_to, sort_order, created_at, updated_at
             FROM rarities
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_rarity(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, rarity: &Rarity) -> Result<Rarity, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO rarities (name, color_from, color_to, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            rarity.name,
            rarity.color_from,
            rarity.color_to,
            rarity.sort_order,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Rarity {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..rarity.clone()
    })
}

pub fn update(conn: &Connection, rarity: &Rarity) -> Result<Rarity, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE rarities SET
            name = ?2, color_from = ?3, color_to = ?4, sort_order = ?5, updated_at = ?6
         WHERE id = ?1",
        params![
            rarity.id,
            rarity.name,
            rarity.color_from,
            rarity.color_to,
            rarity.sort_order,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Rarity {
        updated_at: now,
        ..rarity.clone()
    })
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM rarities WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_rarity(row: &rusqlite::Row) -> Rarity {
    Rarity {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        color_from: row.get(2).unwrap_or_default(),
        color_to: row.get(3).unwrap_or_default(),
        sort_order: row.get(4).unwrap_or_default(),
        created_at: row.get(5).unwrap_or_default(),
        updated_at: row.get(6).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
