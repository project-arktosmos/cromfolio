use rusqlite::{params, Connection};
use crate::models::UserGameStats;

/// Get all game stats
pub fn get_all(conn: &Connection) -> Result<Vec<UserGameStats>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, game_type, total_games_played, total_score, best_score,
                    total_correct, total_wrong, best_streak, longest_game,
                    last_played_at, created_at, updated_at
             FROM _user_game_stats
             ORDER BY game_type ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_user_game_stats(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get stats for a specific game type
pub fn get_by_game_type(conn: &Connection, game_type: &str) -> Result<Option<UserGameStats>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, game_type, total_games_played, total_score, best_score,
                    total_correct, total_wrong, best_streak, longest_game,
                    last_played_at, created_at, updated_at
             FROM _user_game_stats
             WHERE game_type = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![game_type], |row| Ok(row_to_user_game_stats(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// Get or create stats for a game type (ensures a record exists)
pub fn get_or_create(conn: &Connection, game_type: &str) -> Result<UserGameStats, String> {
    match get_by_game_type(conn, game_type)? {
        Some(stats) => Ok(stats),
        None => {
            let now = chrono_now();
            let id = uuid::Uuid::new_v4().to_string();
            let stats = UserGameStats {
                id: id.clone(),
                game_type: game_type.to_string(),
                total_games_played: 0,
                total_score: 0,
                best_score: 0,
                total_correct: 0,
                total_wrong: 0,
                best_streak: 0,
                longest_game: 0,
                last_played_at: None,
                created_at: now.clone(),
                updated_at: now,
            };
            create(conn, &stats)
        }
    }
}

/// Create new game stats
pub fn create(conn: &Connection, stats: &UserGameStats) -> Result<UserGameStats, String> {
    let id = if stats.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        stats.id.clone()
    };

    let now = chrono_now();
    let created_at = if stats.created_at.is_empty() { now.clone() } else { stats.created_at.clone() };
    let updated_at = if stats.updated_at.is_empty() { now } else { stats.updated_at.clone() };

    conn.execute(
        "INSERT INTO _user_game_stats (id, game_type, total_games_played, total_score, best_score,
         total_correct, total_wrong, best_streak, longest_game, last_played_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            stats.game_type,
            stats.total_games_played,
            stats.total_score,
            stats.best_score,
            stats.total_correct,
            stats.total_wrong,
            stats.best_streak,
            stats.longest_game,
            stats.last_played_at,
            created_at,
            updated_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserGameStats {
        id,
        created_at,
        updated_at,
        ..stats.clone()
    })
}

/// Update game stats
pub fn update(conn: &Connection, stats: &UserGameStats) -> Result<UserGameStats, String> {
    let updated_at = chrono_now();

    conn.execute(
        "UPDATE _user_game_stats
         SET total_games_played = ?1, total_score = ?2, best_score = ?3,
             total_correct = ?4, total_wrong = ?5, best_streak = ?6,
             longest_game = ?7, last_played_at = ?8, updated_at = ?9
         WHERE id = ?10",
        params![
            stats.total_games_played,
            stats.total_score,
            stats.best_score,
            stats.total_correct,
            stats.total_wrong,
            stats.best_streak,
            stats.longest_game,
            stats.last_played_at,
            updated_at,
            stats.id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserGameStats {
        updated_at,
        ..stats.clone()
    })
}

/// Update stats after a game session
/// This is a convenience method that handles common stat updates
pub fn record_game(
    conn: &Connection,
    game_type: &str,
    score: i64,
    correct: i64,
    wrong: i64,
    streak: i64,
) -> Result<UserGameStats, String> {
    let mut stats = get_or_create(conn, game_type)?;
    let now = chrono_now();
    let total_questions = correct + wrong;

    stats.total_games_played += 1;
    stats.total_score += score;
    stats.total_correct += correct;
    stats.total_wrong += wrong;

    if score > stats.best_score {
        stats.best_score = score;
    }
    if streak > stats.best_streak {
        stats.best_streak = streak;
    }
    if total_questions > stats.longest_game {
        stats.longest_game = total_questions;
    }

    stats.last_played_at = Some(now);

    update(conn, &stats)
}

/// Delete stats for a specific game type
pub fn delete_by_game_type(conn: &Connection, game_type: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_game_stats WHERE game_type = ?1", params![game_type])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

/// Delete all game stats
pub fn delete_all(conn: &Connection) -> Result<i64, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_game_stats", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected as i64)
}

fn row_to_user_game_stats(row: &rusqlite::Row) -> UserGameStats {
    UserGameStats {
        id: row.get(0).unwrap_or_default(),
        game_type: row.get(1).unwrap_or_default(),
        total_games_played: row.get(2).unwrap_or_default(),
        total_score: row.get(3).unwrap_or_default(),
        best_score: row.get(4).unwrap_or_default(),
        total_correct: row.get(5).unwrap_or_default(),
        total_wrong: row.get(6).unwrap_or_default(),
        best_streak: row.get(7).unwrap_or_default(),
        longest_game: row.get(8).unwrap_or_default(),
        last_played_at: row.get(9).ok(),
        created_at: row.get(10).unwrap_or_default(),
        updated_at: row.get(11).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
