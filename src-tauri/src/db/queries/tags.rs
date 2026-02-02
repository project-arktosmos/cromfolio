use rusqlite::{params, Connection};
use crate::models::{Tag, StickerTag};

// ============================================================================
// TAG CRUD OPERATIONS
// ============================================================================

pub fn get_all(conn: &Connection) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, key, value, created_at, updated_at
             FROM tags
             ORDER BY key ASC, value ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_tag(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, key, value, created_at, updated_at
             FROM tags
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_tag(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_key(conn: &Connection, key: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, key, value, created_at, updated_at
             FROM tags
             WHERE key = ?1
             ORDER BY value ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![key], |row| Ok(row_to_tag(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, tag: &Tag) -> Result<Tag, String> {
    let id = if tag.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        tag.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO tags (id, key, value, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, tag.key, tag.value, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Tag {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..tag.clone()
    })
}

pub fn update(conn: &Connection, tag: &Tag) -> Result<Tag, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE tags SET key = ?2, value = ?3, updated_at = ?4
         WHERE id = ?1",
        params![tag.id, tag.key, tag.value, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Tag {
        updated_at: now,
        ..tag.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

// ============================================================================
// STICKER-TAG RELATIONSHIP OPERATIONS
// ============================================================================

pub fn get_by_sticker_id(conn: &Connection, sticker_id: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.key, t.value, t.created_at, t.updated_at
             FROM tags t
             INNER JOIN sticker_tags st ON t.id = st.tag_id
             WHERE st.sticker_id = ?1
             ORDER BY t.key ASC, t.value ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![sticker_id], |row| Ok(row_to_tag(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn add_tag_to_sticker(conn: &Connection, sticker_id: &str, tag_id: &str) -> Result<StickerTag, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT OR IGNORE INTO sticker_tags (sticker_id, tag_id, created_at)
         VALUES (?1, ?2, ?3)",
        params![sticker_id, tag_id, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(StickerTag {
        sticker_id: sticker_id.to_string(),
        tag_id: tag_id.to_string(),
        created_at: now,
    })
}

pub fn remove_tag_from_sticker(conn: &Connection, sticker_id: &str, tag_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute(
            "DELETE FROM sticker_tags WHERE sticker_id = ?1 AND tag_id = ?2",
            params![sticker_id, tag_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn get_sticker_ids_by_tag_id(conn: &Connection, tag_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sticker_id FROM sticker_tags WHERE tag_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![tag_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all tags for multiple stickers at once (batch operation)
pub fn get_tags_for_stickers(conn: &Connection, sticker_ids: &[String]) -> Result<Vec<(String, Tag)>, String> {
    if sticker_ids.is_empty() {
        return Ok(vec![]);
    }

    // Build placeholders for IN clause
    let placeholders: Vec<String> = sticker_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let query = format!(
        "SELECT st.sticker_id, t.id, t.key, t.value, t.created_at, t.updated_at
         FROM tags t
         INNER JOIN sticker_tags st ON t.id = st.tag_id
         WHERE st.sticker_id IN ({})
         ORDER BY t.key ASC, t.value ASC",
        placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(sticker_ids.iter()), |row| {
            let sticker_id: String = row.get(0)?;
            let tag = Tag {
                id: row.get(1).unwrap_or_default(),
                key: row.get(2).unwrap_or_default(),
                value: row.get(3).unwrap_or_default(),
                created_at: row.get(4).unwrap_or_default(),
                updated_at: row.get(5).unwrap_or_default(),
            };
            Ok((sticker_id, tag))
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn row_to_tag(row: &rusqlite::Row) -> Tag {
    Tag {
        id: row.get(0).unwrap_or_default(),
        key: row.get(1).unwrap_or_default(),
        value: row.get(2).unwrap_or_default(),
        created_at: row.get(3).unwrap_or_default(),
        updated_at: row.get(4).unwrap_or_default(),
    }
}

/// Get sticker names by tag key and value (e.g., key="imdb_id", value="tt1234567")
/// Returns a map of tag values to sticker names for efficient batch lookups
pub fn get_sticker_names_by_tag_values(
    conn: &Connection,
    key: &str,
    values: &[String],
) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;

    if values.is_empty() {
        return Ok(HashMap::new());
    }

    // Build placeholders for IN clause (starting from ?2 since ?1 is the key)
    let placeholders: Vec<String> = values.iter().enumerate().map(|(i, _)| format!("?{}", i + 2)).collect();
    let query = format!(
        "SELECT t.value, s.name
         FROM stickers s
         INNER JOIN sticker_tags st ON s.id = st.sticker_id
         INNER JOIN tags t ON st.tag_id = t.id
         WHERE t.key = ?1 AND t.value IN ({})
         AND s.fragment_position IS NULL",  // Exclude fragment stickers, get full stickers only
        placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // Build params: first the key, then all values
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(values.len() + 1);
    params.push(&key);
    for v in values {
        params.push(v);
    }

    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let tag_value: String = row.get(0)?;
            let sticker_name: String = row.get(1)?;
            Ok((tag_value, sticker_name))
        })
        .map_err(|e| e.to_string())?;

    let mut result = HashMap::new();
    for row in rows {
        let (tag_value, sticker_name) = row.map_err(|e| e.to_string())?;
        result.insert(tag_value, sticker_name);
    }

    Ok(result)
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Get tag keys used by Pokemon stickers, ordered by coverage (most common first)
/// Returns keys that appear on at least 50% of Pokemon stickers
pub fn get_pokemon_common_tag_keys(conn: &Connection) -> Result<Vec<String>, String> {
    let query = "
        SELECT t.key
        FROM tags t
        INNER JOIN sticker_tags st ON t.id = st.tag_id
        INNER JOIN stickers s ON st.sticker_id = s.id
        INNER JOIN sources src ON s.source_id = src.id
        WHERE src.title LIKE 'Pokemon%'
        GROUP BY t.key
        HAVING COUNT(DISTINCT s.id) >= (
            SELECT COUNT(*) * 0.5
            FROM stickers s2
            INNER JOIN sources src2 ON s2.source_id = src2.id
            WHERE src2.title LIKE 'Pokemon%'
        )
        ORDER BY COUNT(DISTINCT s.id) DESC, t.key
    ";

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
