use rusqlite::{params, Connection};
use crate::models::UserBoosterPack;

/// Get all user booster packs
pub fn get_all(conn: &Connection) -> Result<Vec<UserBoosterPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, earned_from, earned_at, opened_at
             FROM _user_booster_packs
             ORDER BY earned_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_booster_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all unopened booster packs
pub fn get_unopened(conn: &Connection) -> Result<Vec<UserBoosterPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, earned_from, earned_at, opened_at
             FROM _user_booster_packs
             WHERE opened_at IS NULL
             ORDER BY earned_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_booster_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all unopened booster packs for a specific collection
pub fn get_unopened_by_collection(conn: &Connection, collection_id: i64) -> Result<Vec<UserBoosterPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, earned_from, earned_at, opened_at
             FROM _user_booster_packs
             WHERE collection_id = ?1 AND opened_at IS NULL
             ORDER BY earned_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_booster_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get booster packs by collection ID (both opened and unopened)
pub fn get_by_collection_id(conn: &Connection, collection_id: i64) -> Result<Vec<UserBoosterPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, earned_from, earned_at, opened_at
             FROM _user_booster_packs
             WHERE collection_id = ?1
             ORDER BY earned_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_user_booster_pack(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get a specific booster pack by ID
pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<UserBoosterPack>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_id, earned_from, earned_at, opened_at
             FROM _user_booster_packs
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_user_booster_pack(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Count unopened booster packs for a collection
pub fn count_unopened_by_collection(conn: &Connection, collection_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM _user_booster_packs WHERE collection_id = ?1 AND opened_at IS NULL",
        params![collection_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Count total unopened booster packs
pub fn count_unopened(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM _user_booster_packs WHERE opened_at IS NULL",
        [],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Create a new booster pack (award to user)
pub fn create(conn: &Connection, booster_pack: &UserBoosterPack) -> Result<UserBoosterPack, String> {
    let earned_at = if booster_pack.earned_at.is_empty() {
        chrono_now()
    } else {
        booster_pack.earned_at.clone()
    };

    conn.execute(
        "INSERT INTO _user_booster_packs (collection_id, earned_from, earned_at, opened_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            booster_pack.collection_id,
            booster_pack.earned_from,
            earned_at,
            booster_pack.opened_at
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(UserBoosterPack {
        id,
        earned_at,
        ..booster_pack.clone()
    })
}

/// Create multiple booster packs at once
pub fn create_batch(conn: &Connection, count: i64, collection_id: i64, earned_from: &str) -> Result<Vec<UserBoosterPack>, String> {
    let now = chrono_now();
    let mut created = Vec::new();

    for _ in 0..count {
        conn.execute(
            "INSERT INTO _user_booster_packs (collection_id, earned_from, earned_at, opened_at)
             VALUES (?1, ?2, ?3, NULL)",
            params![collection_id, earned_from, now],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();

        created.push(UserBoosterPack {
            id,
            collection_id,
            earned_from: earned_from.to_string(),
            earned_at: now.clone(),
            opened_at: None,
        });
    }

    Ok(created)
}

/// Mark a booster pack as opened
pub fn mark_opened(conn: &Connection, id: i64) -> Result<UserBoosterPack, String> {
    let now = chrono_now();

    let rows_affected = conn
        .execute(
            "UPDATE _user_booster_packs SET opened_at = ?1 WHERE id = ?2 AND opened_at IS NULL",
            params![now, id],
        )
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err(format!("Booster pack {} not found or already opened", id));
    }

    get_by_id(conn, id)?
        .ok_or_else(|| format!("Booster pack {} not found after update", id))
}

/// Mark multiple booster packs as opened (up to specified count for a collection)
/// Returns the IDs of the packs that were opened
pub fn mark_opened_batch(conn: &Connection, collection_id: i64, count: i64) -> Result<Vec<i64>, String> {
    let now = chrono_now();

    // Get the IDs of unopened packs for this collection
    let mut stmt = conn
        .prepare(
            "SELECT id FROM _user_booster_packs
             WHERE collection_id = ?1 AND opened_at IS NULL
             ORDER BY earned_at ASC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let ids: Vec<i64> = stmt
        .query_map(params![collection_id, count], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Mark them as opened
    for id in &ids {
        conn.execute(
            "UPDATE _user_booster_packs SET opened_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(ids)
}

/// Delete a booster pack by ID
pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_booster_packs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all booster packs for a collection
pub fn delete_by_collection_id(conn: &Connection, collection_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_booster_packs WHERE collection_id = ?1", params![collection_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all booster packs
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_booster_packs", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

/// Get summary of unopened packs grouped by collection
/// Returns tuples of (collection_id, count)
pub fn get_unopened_summary(conn: &Connection) -> Result<Vec<(i64, i64)>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT collection_id, COUNT(*) as cnt
             FROM _user_booster_packs
             WHERE opened_at IS NULL
             GROUP BY collection_id
             ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn row_to_user_booster_pack(row: &rusqlite::Row) -> UserBoosterPack {
    UserBoosterPack {
        id: row.get(0).unwrap_or_default(),
        collection_id: row.get(1).unwrap_or_default(),
        earned_from: row.get(2).unwrap_or_default(),
        earned_at: row.get(3).unwrap_or_default(),
        opened_at: row.get(4).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
