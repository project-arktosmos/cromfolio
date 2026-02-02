use rusqlite::{params, Connection};
use crate::models::Question;

pub fn get_all(conn: &Connection) -> Result<Vec<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, question_text, correct_answer, wrong_answers,
                    difficulty, created_at, updated_at
             FROM questions
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_question(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, question_text, correct_answer, wrong_answers,
                    difficulty, created_at, updated_at
             FROM questions
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_question(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_by_source_id(conn: &Connection, source_id: &str) -> Result<Vec<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_id, question_text, correct_answer, wrong_answers,
                    difficulty, created_at, updated_at
             FROM questions
             WHERE source_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![source_id], |row| Ok(row_to_question(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn create(conn: &Connection, question: &Question) -> Result<Question, String> {
    let id = if question.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        question.id.clone()
    };

    let now = chrono_now();
    let wrong_answers_json = serde_json::to_string(&question.wrong_answers)
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO questions (
            id, source_id, question_text, correct_answer, wrong_answers,
            difficulty, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            question.source_id,
            question.question_text,
            question.correct_answer,
            wrong_answers_json,
            question.difficulty,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Question {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..question.clone()
    })
}

pub fn update(conn: &Connection, question: &Question) -> Result<Question, String> {
    let now = chrono_now();
    let wrong_answers_json = serde_json::to_string(&question.wrong_answers)
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE questions SET
            source_id = ?2, question_text = ?3, correct_answer = ?4,
            wrong_answers = ?5, difficulty = ?6, updated_at = ?7
         WHERE id = ?1",
        params![
            question.id,
            question.source_id,
            question.question_text,
            question.correct_answer,
            wrong_answers_json,
            question.difficulty,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Question {
        updated_at: now,
        ..question.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM questions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_source_id(conn: &Connection, source_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM questions WHERE source_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_question(row: &rusqlite::Row) -> Question {
    let wrong_answers_json: String = row.get(4).unwrap_or_default();
    let wrong_answers: Vec<String> = serde_json::from_str(&wrong_answers_json)
        .unwrap_or_default();

    Question {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        question_text: row.get(2).unwrap_or_default(),
        correct_answer: row.get(3).unwrap_or_default(),
        wrong_answers,
        difficulty: row.get(5).unwrap_or(None),
        created_at: row.get(6).unwrap_or_default(),
        updated_at: row.get(7).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
