use rusqlite::{params, Connection};
use crate::models::UserPlayer;

/// Get the player profile (singleton - returns the single player record)
pub fn get(conn: &Connection) -> Result<UserPlayer, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, experience, created_at, last_played_at
             FROM _user_player
             WHERE id = 'player'",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([], |row| Ok(row_to_user_player(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(result.map_err(|e| e.to_string())?),
        None => {
            // If no player exists, create default and return it
            let default_player = UserPlayer {
                id: "player".to_string(),
                name: "Adventurer".to_string(),
                experience: 0,
                created_at: chrono_now(),
                last_played_at: chrono_now(),
            };
            create(conn, &default_player)
        }
    }
}

/// Create the player profile
pub fn create(conn: &Connection, player: &UserPlayer) -> Result<UserPlayer, String> {
    let id = if player.id.is_empty() { "player" } else { &player.id };
    let created_at = if player.created_at.is_empty() { chrono_now() } else { player.created_at.clone() };
    let last_played_at = if player.last_played_at.is_empty() { chrono_now() } else { player.last_played_at.clone() };

    conn.execute(
        "INSERT OR REPLACE INTO _user_player (id, name, experience, created_at, last_played_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            id,
            player.name,
            player.experience,
            created_at,
            last_played_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserPlayer {
        id: id.to_string(),
        created_at,
        last_played_at,
        ..player.clone()
    })
}

/// Update the player profile
pub fn update(conn: &Connection, player: &UserPlayer) -> Result<UserPlayer, String> {
    let last_played_at = chrono_now();

    conn.execute(
        "UPDATE _user_player
         SET name = ?1, experience = ?2, last_played_at = ?3
         WHERE id = ?4",
        params![
            player.name,
            player.experience,
            last_played_at,
            player.id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserPlayer {
        last_played_at,
        ..player.clone()
    })
}

/// Add experience to the player
pub fn add_experience(conn: &Connection, amount: i64) -> Result<UserPlayer, String> {
    let last_played_at = chrono_now();

    conn.execute(
        "UPDATE _user_player
         SET experience = experience + ?1, last_played_at = ?2
         WHERE id = 'player'",
        params![amount, last_played_at],
    )
    .map_err(|e| e.to_string())?;

    get(conn)
}

/// Set the player name
pub fn set_name(conn: &Connection, name: &str) -> Result<UserPlayer, String> {
    let last_played_at = chrono_now();

    conn.execute(
        "UPDATE _user_player
         SET name = ?1, last_played_at = ?2
         WHERE id = 'player'",
        params![name, last_played_at],
    )
    .map_err(|e| e.to_string())?;

    get(conn)
}

/// Reset the player profile to defaults
pub fn reset(conn: &Connection) -> Result<UserPlayer, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE _user_player
         SET name = 'Adventurer', experience = 0, created_at = ?1, last_played_at = ?2
         WHERE id = 'player'",
        params![now, now],
    )
    .map_err(|e| e.to_string())?;

    get(conn)
}

/// Delete the player profile
pub fn delete(conn: &Connection) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM _user_player WHERE id = 'player'", [])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_user_player(row: &rusqlite::Row) -> UserPlayer {
    UserPlayer {
        id: row.get(0).unwrap_or_default(),
        name: row.get(1).unwrap_or_else(|_| "Adventurer".to_string()),
        experience: row.get(2).unwrap_or_default(),
        created_at: row.get(3).unwrap_or_default(),
        last_played_at: row.get(4).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
