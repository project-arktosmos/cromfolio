use rusqlite::{params, Connection};
use crate::models::{Furniture, FurnitureType};

pub fn get_all(conn: &Connection) -> Result<Vec<Furniture>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, furniture_type, model_path, scale, thumbnail, description,
                    created_at, updated_at
             FROM furniture
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_furniture(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Furniture>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, furniture_type, model_path, scale, thumbnail, description,
                    created_at, updated_at
             FROM furniture
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_furniture(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_type(conn: &Connection, furniture_type: &str) -> Result<Vec<Furniture>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, furniture_type, model_path, scale, thumbnail, description,
                    created_at, updated_at
             FROM furniture
             WHERE furniture_type = ?1
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![furniture_type], |row| Ok(row_to_furniture(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, furniture: &Furniture) -> Result<Furniture, String> {
    let id = if furniture.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        furniture.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO furniture (
            id, name, furniture_type, model_path, scale, thumbnail, description,
            created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            furniture.name,
            furniture.furniture_type.to_string(),
            furniture.model_path,
            furniture.scale,
            furniture.thumbnail,
            furniture.description,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Furniture {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..furniture.clone()
    })
}

pub fn update(conn: &Connection, furniture: &Furniture) -> Result<Furniture, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE furniture SET
            name = ?2, furniture_type = ?3, model_path = ?4, scale = ?5,
            thumbnail = ?6, description = ?7, updated_at = ?8
         WHERE id = ?1",
        params![
            furniture.id,
            furniture.name,
            furniture.furniture_type.to_string(),
            furniture.model_path,
            furniture.scale,
            furniture.thumbnail,
            furniture.description,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Furniture {
        updated_at: now,
        ..furniture.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM furniture WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_furniture(row: &rusqlite::Row) -> Furniture {
    let furniture_type_str: String = row.get(2).unwrap_or_else(|_| "decoration".to_string());

    Furniture {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        furniture_type: FurnitureType::from_str(&furniture_type_str),
        model_path: row.get(3).unwrap_or_default(),
        scale: row.get(4).unwrap_or(1.0),
        thumbnail: row.get(5).unwrap_or(None),
        description: row.get(6).unwrap_or(None),
        created_at: row.get(7).unwrap_or_default(),
        updated_at: row.get(8).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
