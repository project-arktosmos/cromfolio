//! Generic Query Executor
//!
//! This module provides a simplified query execution interface that receives
//! SQL queries and parameters from the TypeScript frontend. It handles:
//!
//! - Parameterized query execution (SELECT, INSERT, UPDATE, DELETE)
//! - SQL validation to prevent dangerous operations
//! - JSON serialization of results
//! - Transaction support
//!
//! # Security
//!
//! All queries are validated before execution:
//! - Only SELECT, INSERT, UPDATE, DELETE statements are allowed
//! - Dangerous keywords (DROP, CREATE, ALTER, etc.) are blocked
//! - All parameters are bound using SQLite's parameterized queries

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use tauri::{command, State};

use crate::db::Database;

/// Request payload from TypeScript query builder
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub sql: String,
    pub params: Vec<JsonValue>,
}

/// Result returned to TypeScript
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub rows: Vec<JsonValue>,
    pub rows_affected: i64,
    pub last_insert_id: Option<String>,
}

/// Convert JSON value to SQLite parameter
fn json_to_sql_param(value: &JsonValue) -> rusqlite::types::Value {
    match value {
        JsonValue::Null => rusqlite::types::Value::Null,
        JsonValue::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Text(n.to_string())
            }
        }
        JsonValue::String(s) => rusqlite::types::Value::Text(s.clone()),
        JsonValue::Array(arr) => rusqlite::types::Value::Text(serde_json::to_string(arr).unwrap_or_default()),
        JsonValue::Object(obj) => rusqlite::types::Value::Text(serde_json::to_string(obj).unwrap_or_default()),
    }
}

/// Validate SQL to prevent dangerous operations.
/// Only allows SELECT, INSERT, UPDATE, DELETE statements.
fn validate_sql(sql: &str) -> Result<(), String> {
    let sql_trimmed = sql.trim();
    let sql_upper = sql_trimmed.to_uppercase();

    // Must start with an allowed statement
    let allowed_prefixes = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    let starts_with_allowed = allowed_prefixes.iter().any(|p| sql_upper.starts_with(p));

    if !starts_with_allowed {
        return Err(format!(
            "SQL statement must start with one of: {:?}. Got: {}",
            allowed_prefixes,
            &sql_trimmed[..sql_trimmed.len().min(50)]
        ));
    }

    // Block dangerous keywords that could appear anywhere in the statement
    let blocked_keywords = [
        "DROP",
        "CREATE",
        "ALTER",
        "TRUNCATE",
        "ATTACH",
        "DETACH",
        "PRAGMA",
        "VACUUM",
        "ANALYZE",
        "REINDEX",
        "--",  // SQL comment (can hide malicious code)
        "/*",  // Block comment start
    ];

    for keyword in blocked_keywords {
        // Check if the keyword appears as a standalone word (not part of a string literal)
        // This is a simplified check - a more robust solution would parse the SQL
        if sql_upper.contains(keyword) {
            // Additional check: if it's a comment marker, always block
            if keyword == "--" || keyword == "/*" {
                return Err(format!("SQL comments are not allowed: {}", keyword));
            }

            // For keywords, check they're not inside string literals
            // Simple heuristic: if keyword appears and there's no preceding quote on same "word"
            let words: Vec<&str> = sql_upper.split_whitespace().collect();
            for word in words {
                if word.contains(keyword) && !word.starts_with('\'') && !word.starts_with('"') {
                    return Err(format!("SQL contains blocked keyword: {}", keyword));
                }
            }
        }
    }

    Ok(())
}

/// Execute a SELECT query and return rows as JSON
fn execute_select(conn: &Connection, sql: &str, params: &[rusqlite::types::Value]) -> Result<QueryResult, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    // Get column names
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows_iter = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let mut obj = serde_json::Map::new();

            for (i, col_name) in column_names.iter().enumerate() {
                let value: JsonValue = match row.get_ref(i) {
                    Ok(rusqlite::types::ValueRef::Null) => JsonValue::Null,
                    Ok(rusqlite::types::ValueRef::Integer(n)) => json!(n),
                    Ok(rusqlite::types::ValueRef::Real(f)) => {
                        serde_json::Number::from_f64(f)
                            .map(JsonValue::Number)
                            .unwrap_or(JsonValue::Null)
                    }
                    Ok(rusqlite::types::ValueRef::Text(s)) => {
                        JsonValue::String(String::from_utf8_lossy(s).to_string())
                    }
                    Ok(rusqlite::types::ValueRef::Blob(b)) => {
                        // Return blob as base64 encoded string
                        JsonValue::String(format!("[BLOB:{} bytes]", b.len()))
                    }
                    Err(_) => JsonValue::Null,
                };
                obj.insert(col_name.clone(), value);
            }

            Ok(JsonValue::Object(obj))
        })
        .map_err(|e| format!("Query execution failed: {}", e))?;

    let rows: Vec<JsonValue> = rows_iter.filter_map(|r| r.ok()).collect();

    Ok(QueryResult {
        rows,
        rows_affected: 0,
        last_insert_id: None,
    })
}

/// Execute INSERT/UPDATE/DELETE and return affected count
fn execute_modify(conn: &Connection, sql: &str, params: &[rusqlite::types::Value]) -> Result<QueryResult, String> {
    let rows_affected = conn
        .execute(sql, rusqlite::params_from_iter(params.iter()))
        .map_err(|e| format!("Query execution failed: {}", e))?;

    let last_id = conn.last_insert_rowid();

    Ok(QueryResult {
        rows: vec![],
        rows_affected: rows_affected as i64,
        last_insert_id: if last_id > 0 {
            Some(last_id.to_string())
        } else {
            None
        },
    })
}

/// Execute a parameterized SQL query.
///
/// This is the primary interface for executing queries from TypeScript.
/// All queries must be parameterized - never interpolate values into SQL strings.
///
/// # Arguments
///
/// * `sql` - The SQL query with ?1, ?2, etc. placeholders
/// * `params` - Array of parameter values to bind
///
/// # Returns
///
/// For SELECT: Returns rows as JSON objects
/// For INSERT/UPDATE/DELETE: Returns rows_affected count
///
/// # Example
///
/// ```typescript
/// const result = await invoke('execute_query', {
///   sql: 'SELECT * FROM users WHERE id = ?1',
///   params: ['user-123']
/// });
/// ```
#[command]
pub fn execute_query(sql: String, params: Vec<JsonValue>, db: State<'_, Database>) -> Result<QueryResult, String> {
    // Validate SQL before execution
    validate_sql(&sql)?;

    let conn = db.conn.lock().map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    // Convert JSON params to SQLite values
    let sql_params: Vec<rusqlite::types::Value> = params.iter().map(json_to_sql_param).collect();

    // Determine query type
    let sql_upper = sql.trim().to_uppercase();

    if sql_upper.starts_with("SELECT") {
        execute_select(&conn, &sql, &sql_params)
    } else {
        execute_modify(&conn, &sql, &sql_params)
    }
}

/// Execute multiple queries in a transaction.
///
/// All queries succeed or all fail together (atomic).
///
/// # Arguments
///
/// * `queries` - Array of QueryRequest objects
///
/// # Returns
///
/// Array of QueryResult, one for each query
///
/// # Example
///
/// ```typescript
/// const results = await invoke('execute_transaction', {
///   queries: [
///     { sql: 'INSERT INTO users (id, name) VALUES (?1, ?2)', params: ['1', 'John'] },
///     { sql: 'INSERT INTO profiles (user_id, bio) VALUES (?1, ?2)', params: ['1', 'Hello'] }
///   ]
/// });
/// ```
#[command]
pub fn execute_transaction(queries: Vec<QueryRequest>, db: State<'_, Database>) -> Result<Vec<QueryResult>, String> {
    // Validate all queries first
    for query in &queries {
        validate_sql(&query.sql)?;
    }

    let conn = db.conn.lock().map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    // Start transaction
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut results = Vec::new();

    for query in queries {
        let sql_params: Vec<rusqlite::types::Value> = query.params.iter().map(json_to_sql_param).collect();

        let result = if query.sql.trim().to_uppercase().starts_with("SELECT") {
            execute_select(&conn, &query.sql, &sql_params)
        } else {
            execute_modify(&conn, &query.sql, &sql_params)
        };

        match result {
            Ok(r) => results.push(r),
            Err(e) => {
                // Rollback on error
                let _ = conn.execute("ROLLBACK", []);
                return Err(format!("Transaction failed: {}", e));
            }
        }
    }

    // Commit transaction
    conn.execute("COMMIT", [])
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            format!("Failed to commit transaction: {}", e)
        })?;

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_sql_select() {
        assert!(validate_sql("SELECT * FROM users").is_ok());
        assert!(validate_sql("  SELECT id FROM users WHERE name = ?1").is_ok());
    }

    #[test]
    fn test_validate_sql_insert() {
        assert!(validate_sql("INSERT INTO users (id, name) VALUES (?1, ?2)").is_ok());
    }

    #[test]
    fn test_validate_sql_update() {
        assert!(validate_sql("UPDATE users SET name = ?1 WHERE id = ?2").is_ok());
    }

    #[test]
    fn test_validate_sql_delete() {
        assert!(validate_sql("DELETE FROM users WHERE id = ?1").is_ok());
    }

    #[test]
    fn test_validate_sql_blocks_drop() {
        assert!(validate_sql("DROP TABLE users").is_err());
    }

    #[test]
    fn test_validate_sql_blocks_create() {
        assert!(validate_sql("CREATE TABLE evil (id TEXT)").is_err());
    }

    #[test]
    fn test_validate_sql_blocks_pragma() {
        assert!(validate_sql("PRAGMA table_info(users)").is_err());
    }

    #[test]
    fn test_validate_sql_blocks_comments() {
        assert!(validate_sql("SELECT * FROM users -- WHERE admin = true").is_err());
        assert!(validate_sql("SELECT * FROM users /* comment */").is_err());
    }

    #[test]
    fn test_validate_sql_blocks_alter() {
        // Even if disguised inside a valid-looking query
        assert!(validate_sql("SELECT * FROM users; ALTER TABLE users").is_err());
    }

    #[test]
    fn test_json_to_sql_param() {
        assert!(matches!(
            json_to_sql_param(&JsonValue::Null),
            rusqlite::types::Value::Null
        ));

        assert!(matches!(
            json_to_sql_param(&JsonValue::Bool(true)),
            rusqlite::types::Value::Integer(1)
        ));

        assert!(matches!(
            json_to_sql_param(&JsonValue::String("test".to_string())),
            rusqlite::types::Value::Text(s) if s == "test"
        ));

        assert!(matches!(
            json_to_sql_param(&json!(42)),
            rusqlite::types::Value::Integer(42)
        ));

        assert!(matches!(
            json_to_sql_param(&json!(3.14)),
            rusqlite::types::Value::Real(f) if (f - 3.14).abs() < 0.001
        ));
    }
}
