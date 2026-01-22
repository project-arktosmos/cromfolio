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

// ============================================================================
// ALBUMS
// ============================================================================

#[command]
pub fn get_all_albums(db: State<'_, Database>) -> Result<Vec<Album>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::albums::get_all(&conn)
}

#[command]
pub fn get_album(id: String, db: State<'_, Database>) -> Result<Option<Album>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::albums::get_by_id(&conn, &id)
}

#[command]
pub fn create_album(album: Album, db: State<'_, Database>) -> Result<Album, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::albums::create(&conn, &album)
}

#[command]
pub fn update_album(album: Album, db: State<'_, Database>) -> Result<Album, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::albums::update(&conn, &album)
}

#[command]
pub fn delete_album(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::albums::delete(&conn, &id)
}

// ============================================================================
// CARDS
// ============================================================================

#[command]
pub fn get_all_cards(db: State<'_, Database>) -> Result<Vec<Card>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::get_all(&conn)
}

#[command]
pub fn get_cards_by_album(album_id: String, db: State<'_, Database>) -> Result<Vec<Card>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::get_by_album_id(&conn, &album_id)
}

#[command]
pub fn get_card(id: String, db: State<'_, Database>) -> Result<Option<Card>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::get_by_id(&conn, &id)
}

#[command]
pub fn create_card(card: Card, db: State<'_, Database>) -> Result<Card, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::create(&conn, &card)
}

#[command]
pub fn update_card(card: Card, db: State<'_, Database>) -> Result<Card, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::update(&conn, &card)
}

#[command]
pub fn delete_card(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::delete(&conn, &id)
}

#[command]
pub fn delete_cards_by_album(album_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::cards::delete_by_album_id(&conn, &album_id)
}

// ============================================================================
// SOURCES
// ============================================================================

#[command]
pub fn get_all_sources(db: State<'_, Database>) -> Result<Vec<Source>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::get_all(&conn)
}

#[command]
pub fn get_sources_by_album(album_id: String, db: State<'_, Database>) -> Result<Vec<Source>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::get_by_album_id(&conn, &album_id)
}

#[command]
pub fn source_exists(external_id_type: String, external_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::exists(&conn, &external_id_type, &external_id)
}

#[command]
pub fn get_source_by_external_id(external_id_type: String, external_id: String, db: State<'_, Database>) -> Result<Option<Source>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::get_by_external_id(&conn, &external_id_type, &external_id)
}

#[command]
pub fn create_source(source: Source, db: State<'_, Database>) -> Result<Source, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::create(&conn, &source)
}

#[command]
pub fn delete_source(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::delete(&conn, &id)
}

// ============================================================================
// RARITIES
// ============================================================================

#[command]
pub fn get_all_rarities(db: State<'_, Database>) -> Result<Vec<Rarity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::rarities::get_all(&conn)
}

#[command]
pub fn get_rarity(id: String, db: State<'_, Database>) -> Result<Option<Rarity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::rarities::get_by_id(&conn, &id)
}

#[command]
pub fn create_rarity(rarity: Rarity, db: State<'_, Database>) -> Result<Rarity, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::rarities::create(&conn, &rarity)
}

#[command]
pub fn update_rarity(rarity: Rarity, db: State<'_, Database>) -> Result<Rarity, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::rarities::update(&conn, &rarity)
}

#[command]
pub fn delete_rarity(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::rarities::delete(&conn, &id)
}

// ============================================================================
// QUESTIONS (trivia)
// ============================================================================

#[command]
pub fn get_all_questions(db: State<'_, Database>) -> Result<Vec<Question>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::get_all(&conn)
}

#[command]
pub fn get_questions_by_album(album_id: String, db: State<'_, Database>) -> Result<Vec<Question>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::get_by_album_id(&conn, &album_id)
}

#[command]
pub fn get_question(id: String, db: State<'_, Database>) -> Result<Option<Question>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::get_by_id(&conn, &id)
}

#[command]
pub fn create_question(question: Question, db: State<'_, Database>) -> Result<Question, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::create(&conn, &question)
}

#[command]
pub fn update_question(question: Question, db: State<'_, Database>) -> Result<Question, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::update(&conn, &question)
}

#[command]
pub fn delete_question(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::delete(&conn, &id)
}

#[command]
pub fn delete_questions_by_album(album_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::delete_by_album_id(&conn, &album_id)
}
