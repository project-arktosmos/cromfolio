use rusqlite::{params, Connection};
use crate::models::Settings;

pub fn get(conn: &Connection) -> Result<Settings, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, app_name, theme, updated_at
             FROM settings
             WHERE id = 'app-settings'",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([], |row| {
            Ok(Settings {
                id: row.get(0)?,
                app_name: row.get(1)?,
                theme: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(result.map_err(|e| e.to_string())?),
        None => Err("Settings not found".to_string()),
    }
}

pub fn update(conn: &Connection, settings: &Settings) -> Result<Settings, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE settings
         SET app_name = ?2, theme = ?3, updated_at = ?4
         WHERE id = ?1",
        params![settings.id, settings.app_name, settings.theme, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Settings {
        updated_at: now,
        ..settings.clone()
    })
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
