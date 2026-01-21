use tauri::{command, State};
use crate::db::{Database, queries};
use crate::models::*;

// ============================================================================
// SETTINGS (singleton)
// ============================================================================

#[command]
pub fn get_settings(db: State<'_, Database>) -> Result<Settings, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::settings::get(&conn)
}

#[command]
pub fn update_settings(settings: Settings, db: State<'_, Database>) -> Result<Settings, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::settings::update(&conn, &settings)
}

// ============================================================================
// ITEMS (example CRUD resource)
// ============================================================================

#[command]
pub fn get_all_items(db: State<'_, Database>) -> Result<Vec<Item>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::items::get_all(&conn)
}

#[command]
pub fn get_item(id: String, db: State<'_, Database>) -> Result<Option<Item>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::items::get_by_id(&conn, &id)
}

#[command]
pub fn create_item(item: Item, db: State<'_, Database>) -> Result<Item, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::items::create(&conn, &item)
}

#[command]
pub fn update_item(item: Item, db: State<'_, Database>) -> Result<Item, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::items::update(&conn, &item)
}

#[command]
pub fn delete_item(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::items::delete(&conn, &id)
}
