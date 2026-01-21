use rusqlite::{params, Connection};
use crate::models::Item;

pub fn get_all(conn: &Connection) -> Result<Vec<Item>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, created_at, updated_at
             FROM items
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Item>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, category, created_at, updated_at
             FROM items
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, item: &Item) -> Result<Item, String> {
    let id = if item.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        item.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO items (id, name, description, category, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, item.name, item.description, item.category, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Item {
        id,
        name: item.name.clone(),
        description: item.description.clone(),
        category: item.category.clone(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update(conn: &Connection, item: &Item) -> Result<Item, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE items
         SET name = ?2, description = ?3, category = ?4, updated_at = ?5
         WHERE id = ?1",
        params![item.id, item.name, item.description, item.category, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Item {
        updated_at: now,
        ..item.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
