use rusqlite::{params, Connection};
use crate::models::UserCollection;

/// Get all user collection progress records
pub fn get_all(conn: &Connection) -> Result<Vec<UserCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, started_at, completed_at
             FROM _user_collections
             ORDER BY started_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get user collection progress by collection_id
pub fn get_by_collection_id(conn: &Connection, collection_id: i64) -> Result<Option<UserCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, started_at, completed_at
             FROM _user_collections
             WHERE collection_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_collection(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Get a specific user collection by ID
pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<UserCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, started_at, completed_at
             FROM _user_collections
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_collection(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Get all completed user collections
pub fn get_completed(conn: &Connection) -> Result<Vec<UserCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, started_at, completed_at
             FROM _user_collections
             WHERE completed_at IS NOT NULL
             ORDER BY completed_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all in-progress (not completed) user collections
pub fn get_in_progress(conn: &Connection) -> Result<Vec<UserCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, started_at, completed_at
             FROM _user_collections
             WHERE completed_at IS NULL
             ORDER BY started_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Create a new user collection progress record (start tracking a collection)
pub fn create(conn: &Connection, user_collection: &UserCollection) -> Result<UserCollection, String> {
    let started_at = if user_collection.started_at.is_empty() {
        chrono_now()
    } else {
        user_collection.started_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_collections (collection_id, started_at, completed_at)
         VALUES (?1, ?2, ?3)",
        params![
            user_collection.collection_id,
            started_at,
            user_collection.completed_at
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(UserCollection {
        id,
        started_at,
        ..user_collection.clone()
    })
}

/// Update a user collection (e.g., mark as completed)
pub fn update(conn: &Connection, user_collection: &UserCollection) -> Result<UserCollection, String> {
    conn.execute(
        "UPDATE _user_collections SET
            collection_id = ?2, started_at = ?3, completed_at = ?4
         WHERE id = ?1",
        params![
            user_collection.id,
            user_collection.collection_id,
            user_collection.started_at,
            user_collection.completed_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(user_collection.clone())
}

/// Mark a collection as completed
pub fn mark_completed(conn: &Connection, collection_id: i64) -> Result<bool, String> {
    let now = chrono_now();
    let rows_affected = conn
        .execute(
            "UPDATE _user_collections SET completed_at = ?2 WHERE collection_id = ?1",
            params![collection_id, now],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete a user collection progress record by ID
pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_collections WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete a user collection progress record by collection_id
pub fn delete_by_collection_id(conn: &Connection, collection_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_collections WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all user collection progress records
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_collections", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_collection(row: &rusqlite::Row) -> UserCollection {
    UserCollection {
        id: row.get(0).unwrap_or_default(),
        collection_id: row.get(1).unwrap_or_default(),
        started_at: row.get(2).unwrap_or_default(),
        completed_at: row.get(3).unwrap_or(None),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
