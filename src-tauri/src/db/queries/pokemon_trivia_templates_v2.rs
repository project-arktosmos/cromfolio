use rusqlite::{params, Connection};
use crate::models::PokemonTriviaTemplateV2;

pub fn get_all(conn: &Connection) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
             ORDER BY template_type, name, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
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

pub fn get_by_template_type(conn: &Connection, template_type: &str) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
             WHERE template_type = ?1
             ORDER BY name, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![template_type], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_primary_attribute(conn: &Connection, primary_attribute: &str) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
             WHERE primary_attribute = ?1
             ORDER BY template_type, name, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![primary_attribute], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_active(conn: &Connection) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
             WHERE is_active = 1
             ORDER BY template_type, name, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_difficulty(conn: &Connection, difficulty: &str) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, template_type,
                    question_template, answer_template, primary_attribute,
                    conditions, condition_logic, scope_filters, comparison_config,
                    difficulty, weight, is_active, created_at, updated_at
             FROM pokemon_trivia_templates_v2
             WHERE difficulty = ?1 AND is_active = 1
             ORDER BY template_type, name, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![difficulty], |row| Ok(row_to_template(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all unique template types that have templates
pub fn get_unique_template_types(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT template_type FROM pokemon_trivia_templates_v2 ORDER BY template_type")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get all unique primary attributes that have templates
pub fn get_unique_primary_attributes(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT DISTINCT primary_attribute FROM pokemon_trivia_templates_v2 ORDER BY primary_attribute")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, template: &PokemonTriviaTemplateV2) -> Result<PokemonTriviaTemplateV2, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO pokemon_trivia_templates_v2 (
            name, description, template_type,
            question_template, answer_template, primary_attribute,
            conditions, condition_logic, scope_filters, comparison_config,
            difficulty, weight, is_active, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            template.name,
            template.description,
            template.template_type,
            template.question_template,
            template.answer_template,
            template.primary_attribute,
            template.conditions,
            template.condition_logic,
            template.scope_filters,
            template.comparison_config,
            template.difficulty,
            template.weight,
            template.is_active as i32,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(PokemonTriviaTemplateV2 {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..template.clone()
    })
}

pub fn update(conn: &Connection, template: &PokemonTriviaTemplateV2) -> Result<PokemonTriviaTemplateV2, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE pokemon_trivia_templates_v2 SET
            name = ?2, description = ?3, template_type = ?4,
            question_template = ?5, answer_template = ?6, primary_attribute = ?7,
            conditions = ?8, condition_logic = ?9, scope_filters = ?10,
            comparison_config = ?11, difficulty = ?12, weight = ?13,
            is_active = ?14, updated_at = ?15
         WHERE id = ?1",
        params![
            template.id,
            template.name,
            template.description,
            template.template_type,
            template.question_template,
            template.answer_template,
            template.primary_attribute,
            template.conditions,
            template.condition_logic,
            template.scope_filters,
            template.comparison_config,
            template.difficulty,
            template.weight,
            template.is_active as i32,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(PokemonTriviaTemplateV2 {
        updated_at: now,
        ..template.clone()
    })
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM pokemon_trivia_templates_v2 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_template(row: &rusqlite::Row) -> PokemonTriviaTemplateV2 {
    PokemonTriviaTemplateV2 {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_default(),
        description: row.get(2).unwrap_or_default(),
        template_type: row.get(3).unwrap_or_default(),
        question_template: row.get(4).unwrap_or_default(),
        answer_template: row.get(5).unwrap_or_default(),
        primary_attribute: row.get(6).unwrap_or_default(),
        conditions: row.get(7).unwrap_or_else(|_| "[]".to_string()),
        condition_logic: row.get(8).unwrap_or_else(|_| "and".to_string()),
        scope_filters: row.get(9).unwrap_or_else(|_| "{}".to_string()),
        comparison_config: row.get(10).ok(),
        difficulty: row.get(11).ok(),
        weight: row.get(12).unwrap_or(100),
        is_active: row.get::<_, i32>(13).unwrap_or(1) == 1,
        created_at: row.get(14).unwrap_or_default(),
        updated_at: row.get(15).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
