use rusqlite::{params, Connection};
use crate::models::PokemonTriviaTemplate;

pub fn get_all(conn: &Connection) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, tag_key, question_template, answer_template,
                    is_active, created_at, updated_at
             FROM pokemon_trivia_templates
             ORDER BY tag_key, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<PokemonTriviaTemplate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, tag_key, question_template, answer_template,
                    is_active, created_at, updated_at
             FROM pokemon_trivia_templates
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_tag_key(conn: &Connection, tag_key: &str) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, tag_key, question_template, answer_template,
                    is_active, created_at, updated_at
             FROM pokemon_trivia_templates
             WHERE tag_key = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![tag_key], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_active(conn: &Connection) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, tag_key, question_template, answer_template,
                    is_active, created_at, updated_at
             FROM pokemon_trivia_templates
             WHERE is_active = 1
             ORDER BY tag_key, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all unique tag keys that have templates
pub fn get_unique_tag_keys(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT tag_key FROM pokemon_trivia_templates ORDER BY tag_key")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, template: &PokemonTriviaTemplate) -> Result<PokemonTriviaTemplate, String> {
    let id = if template.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        template.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO pokemon_trivia_templates (
            id, tag_key, question_template, answer_template,
            is_active, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            template.tag_key,
            template.question_template,
            template.answer_template,
            template.is_active as i32,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(PokemonTriviaTemplate {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..template.clone()
    })
}

pub fn update(conn: &Connection, template: &PokemonTriviaTemplate) -> Result<PokemonTriviaTemplate, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE pokemon_trivia_templates SET
            tag_key = ?2, question_template = ?3, answer_template = ?4,
            is_active = ?5, updated_at = ?6
         WHERE id = ?1",
        params![
            template.id,
            template.tag_key,
            template.question_template,
            template.answer_template,
            template.is_active as i32,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(PokemonTriviaTemplate {
        updated_at: now,
        ..template.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM pokemon_trivia_templates WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_template(row: &rusqlite::Row) -> PokemonTriviaTemplate {
    PokemonTriviaTemplate {
        id: row.get(0).unwrap_or_default(),
        tag_key: row.get(1).unwrap_or_default(),
        question_template: row.get(2).unwrap_or_default(),
        answer_template: row.get(3).unwrap_or_default(),
        is_active: row.get::<_, i32>(4).unwrap_or(1) == 1,
        created_at: row.get(5).unwrap_or_default(),
        updated_at: row.get(6).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
