use rusqlite::{params, Connection};
use crate::models::Stamp;

pub fn get_all(conn: &Connection) -> Result<Vec<Stamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, pack_id, image_path, emojis, created_at
             FROM stamps
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_stamp(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_pack_id(conn: &Connection, pack_id: i64) -> Result<Vec<Stamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, pack_id, image_path, emojis, created_at
             FROM stamps
             WHERE pack_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![pack_id], |row| Ok(row_to_stamp(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Stamp>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, pack_id, image_path, emojis, created_at
             FROM stamps
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_stamp(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, stamp: &Stamp) -> Result<Stamp, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO stamps (pack_id, image_path, emojis, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            stamp.pack_id,
            stamp.image_path,
            stamp.emojis,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Stamp {
        id,
        created_at: now,
        ..stamp.clone()
    })
}

/// Batch create multiple stamps in a single transaction
pub fn create_batch(conn: &Connection, stamps: &[Stamp]) -> Result<Vec<Stamp>, String> {
    let now = chrono_now();
    let mut created_stamps = Vec::with_capacity(stamps.len());

    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    for stamp in stamps {
        let result = conn.execute(
            "INSERT INTO stamps (pack_id, image_path, emojis, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                stamp.pack_id,
                stamp.image_path,
                stamp.emojis,
                now
            ],
        );

        match result {
            Ok(_) => {
                let id = conn.last_insert_rowid();
                created_stamps.push(Stamp {
                    id,
                    created_at: now.clone(),
                    ..stamp.clone()
                });
            }
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                return Err(format!("Failed to insert stamp: {}", e));
            }
        }
    }

    conn.execute("COMMIT", [])
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            format!("Failed to commit transaction: {}", e)
        })?;

    Ok(created_stamps)
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM stamps WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_pack_id(conn: &Connection, pack_id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM stamps WHERE pack_id = ?1", params![pack_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_stamp(row: &rusqlite::Row) -> Stamp {
    Stamp {
        id: row.get(0).unwrap_or_default(),
        pack_id: row.get(1).unwrap_or_default(),
        image_path: row.get(2).unwrap_or_default(),
        emojis: row.get(3).unwrap_or(None),
        created_at: row.get(4).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
