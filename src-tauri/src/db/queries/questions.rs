use rusqlite::{params, Connection};
use crate::models::Question;

pub fn get_all(conn: &Connection) -> Result<Vec<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, question_text, answer_a, answer_b, answer_c,
                    correct_answer, difficulty, created_at, updated_at
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
            "SELECT id, album_id, question_text, answer_a, answer_b, answer_c,
                    correct_answer, difficulty, created_at, updated_at
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

pub fn get_by_album_id(conn: &Connection, album_id: &str) -> Result<Vec<Question>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, question_text, answer_a, answer_b, answer_c,
                    correct_answer, difficulty, created_at, updated_at
             FROM questions
             WHERE album_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![album_id], |row| Ok(row_to_question(row)))
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

    conn.execute(
        "INSERT INTO questions (
            id, album_id, question_text, answer_a, answer_b, answer_c,
            correct_answer, difficulty, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            question.album_id,
            question.question_text,
            question.answer_a,
            question.answer_b,
            question.answer_c,
            question.correct_answer,
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

    conn.execute(
        "UPDATE questions SET
            album_id = ?2, question_text = ?3, answer_a = ?4, answer_b = ?5,
            answer_c = ?6, correct_answer = ?7, difficulty = ?8, updated_at = ?9
         WHERE id = ?1",
        params![
            question.id,
            question.album_id,
            question.question_text,
            question.answer_a,
            question.answer_b,
            question.answer_c,
            question.correct_answer,
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

pub fn delete_by_album_id(conn: &Connection, album_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM questions WHERE album_id = ?1", params![album_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_question(row: &rusqlite::Row) -> Question {
    Question {
        id: row.get(0).unwrap_or_default(),
        album_id: row.get(1).unwrap_or_default(),
        question_text: row.get(2).unwrap_or_default(),
        answer_a: row.get(3).unwrap_or_default(),
        answer_b: row.get(4).unwrap_or_default(),
        answer_c: row.get(5).unwrap_or_default(),
        correct_answer: row.get(6).unwrap_or_default(),
        difficulty: row.get(7).unwrap_or(None),
        created_at: row.get(8).unwrap_or_default(),
        updated_at: row.get(9).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
