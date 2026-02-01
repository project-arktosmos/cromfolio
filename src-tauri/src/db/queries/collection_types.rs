use rusqlite::{params, Connection};
use crate::models::CollectionType;

pub fn get_all(conn: &Connection) -> Result<Vec<CollectionType>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, icon, sort_order, created_at, updated_at
             FROM collection_types
             ORDER BY sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_collection_type(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<CollectionType>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, icon, sort_order, created_at, updated_at
             FROM collection_types
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_collection_type(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, collection_type: &CollectionType) -> Result<CollectionType, String> {
    let id = if collection_type.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        collection_type.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO collection_types (id, name, description, icon, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            collection_type.name,
            collection_type.description,
            collection_type.icon,
            collection_type.sort_order,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(CollectionType {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..collection_type.clone()
    })
}

pub fn update(conn: &Connection, collection_type: &CollectionType) -> Result<CollectionType, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE collection_types SET
            name = ?2, description = ?3, icon = ?4, sort_order = ?5, updated_at = ?6
         WHERE id = ?1",
        params![
            collection_type.id,
            collection_type.name,
            collection_type.description,
            collection_type.icon,
            collection_type.sort_order,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(CollectionType {
        updated_at: now,
        ..collection_type.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM collection_types WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_collection_type(row: &rusqlite::Row) -> CollectionType {
    CollectionType {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        description: row.get(2).unwrap_or_default(),
        icon: row.get(3).unwrap_or(None),
        sort_order: row.get(4).unwrap_or_default(),
        created_at: row.get(5).unwrap_or_default(),
        updated_at: row.get(6).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
