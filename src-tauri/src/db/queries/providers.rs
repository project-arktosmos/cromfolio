use rusqlite::{params, Connection};
use crate::models::Provider;

pub fn get_all(conn: &Connection) -> Result<Vec<Provider>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, provider_type, external_id, external_id_type, created_at
             FROM providers
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_provider(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_source_id(conn: &Connection, source_id: &str) -> Result<Vec<Provider>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, provider_type, external_id, external_id_type, created_at
             FROM providers
             WHERE source_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source_id], |row| Ok(row_to_provider(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_external_id(
    conn: &Connection,
    external_id_type: &str,
    external_id: &str,
) -> Result<Option<Provider>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, provider_type, external_id, external_id_type, created_at
             FROM providers
             WHERE external_id_type = ?1 AND external_id = ?2",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![external_id_type, external_id], |row| {
            Ok(row_to_provider(row))
        })
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn exists(
    conn: &Connection,
    external_id_type: &str,
    external_id: &str,
) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM providers WHERE external_id_type = ?1 AND external_id = ?2",
            params![external_id_type, external_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

pub fn create(conn: &Connection, provider: &Provider) -> Result<Provider, String> {
    let id = if provider.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        provider.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO providers (id, source_id, provider_type, external_id, external_id_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            provider.source_id,
            provider.provider_type,
            provider.external_id,
            provider.external_id_type,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Provider {
        id,
        created_at: now,
        ..provider.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM providers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_source_id(conn: &Connection, source_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM providers WHERE source_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_provider(row: &rusqlite::Row) -> Provider {
    Provider {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        provider_type: row.get(2).unwrap_or_default(),
        external_id: row.get(3).unwrap_or_default(),
        external_id_type: row.get(4).unwrap_or_default(),
        created_at: row.get(5).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
