use rusqlite::{params, Connection};
use crate::models::{LlmConfig, LlmProvider};

pub fn get_all(conn: &Connection) -> Result<Vec<LlmConfig>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, provider, base_url, is_default, created_at, updated_at
             FROM llm_configs
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_llm_config(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<LlmConfig>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, provider, base_url, is_default, created_at, updated_at
             FROM llm_configs
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_llm_config(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_default(conn: &Connection) -> Result<Option<LlmConfig>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, provider, base_url, is_default, created_at, updated_at
             FROM llm_configs
             WHERE is_default = 1
             LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([], |row| Ok(row_to_llm_config(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, config: &LlmConfig) -> Result<LlmConfig, String> {
    let id = if config.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        config.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO llm_configs (id, name, provider, base_url, is_default, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            config.name,
            config.provider.to_string(),
            config.base_url,
            config.is_default as i32,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(LlmConfig {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..config.clone()
    })
}

pub fn update(conn: &Connection, config: &LlmConfig) -> Result<LlmConfig, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE llm_configs SET
            name = ?2, provider = ?3, base_url = ?4, is_default = ?5, updated_at = ?6
         WHERE id = ?1",
        params![
            config.id,
            config.name,
            config.provider.to_string(),
            config.base_url,
            config.is_default as i32,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(LlmConfig {
        updated_at: now,
        ..config.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM llm_configs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn set_default(conn: &Connection, id: &str) -> Result<bool, String> {
    // First, clear all defaults
    conn.execute("UPDATE llm_configs SET is_default = 0", [])
        .map_err(|e| e.to_string())?;

    // Then set the new default
    let rows_affected = conn
        .execute(
            "UPDATE llm_configs SET is_default = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_llm_config(row: &rusqlite::Row) -> LlmConfig {
    let provider_str: String = row.get(2).unwrap_or_else(|_| "lmstudio".to_string());
    let is_default_int: i32 = row.get(4).unwrap_or(0);

    LlmConfig {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        provider: LlmProvider::from_str(&provider_str),
        base_url: row.get(3).unwrap_or_default(),
        is_default: is_default_int != 0,
        created_at: row.get(5).unwrap_or_default(),
        updated_at: row.get(6).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
