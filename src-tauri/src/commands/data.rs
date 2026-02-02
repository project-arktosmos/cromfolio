use tauri::{command, Manager, State};
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
// SOURCES (formerly ALBUMS)
// ============================================================================

#[command]
pub fn get_all_sources(db: State<'_, Database>) -> Result<Vec<Source>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::get_all(&conn)
}

#[command]
pub fn get_source(id: String, db: State<'_, Database>) -> Result<Option<Source>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::get_by_id(&conn, &id)
}

#[command]
pub fn create_source(source: Source, db: State<'_, Database>) -> Result<Source, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::create(&conn, &source)
}

#[command]
pub fn update_source(source: Source, db: State<'_, Database>) -> Result<Source, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::update(&conn, &source)
}

#[command]
pub fn delete_source(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sources::delete(&conn, &id)
}

// ============================================================================
// STICKERS (formerly BLUEPRINTS/TEMPLATES)
// ============================================================================

#[command]
pub fn get_all_stickers(db: State<'_, Database>) -> Result<Vec<Sticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::get_all(&conn)
}

#[command]
pub fn get_stickers_by_source(source_id: String, db: State<'_, Database>) -> Result<Vec<Sticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::get_by_source_id(&conn, &source_id)
}

#[command]
pub fn get_sticker(id: String, db: State<'_, Database>) -> Result<Option<Sticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::get_by_id(&conn, &id)
}

#[command]
pub fn create_sticker(sticker: Sticker, db: State<'_, Database>) -> Result<Sticker, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::create(&conn, &sticker)
}

#[command]
pub fn update_sticker(sticker: Sticker, db: State<'_, Database>) -> Result<Sticker, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::update(&conn, &sticker)
}

#[command]
pub fn delete_sticker(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::delete(&conn, &id)
}

#[command]
pub fn delete_stickers_by_source(source_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::delete_by_source_id(&conn, &source_id)
}

#[command]
pub fn create_stickers_batch(stickers: Vec<Sticker>, db: State<'_, Database>) -> Result<Vec<Sticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stickers::create_batch(&conn, &stickers)
}

// ============================================================================
// PROVIDERS (formerly SOURCES - external API tracking)
// ============================================================================

#[command]
pub fn get_all_providers(db: State<'_, Database>) -> Result<Vec<Provider>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::get_all(&conn)
}

#[command]
pub fn get_providers_by_source(source_id: String, db: State<'_, Database>) -> Result<Vec<Provider>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::get_by_source_id(&conn, &source_id)
}

#[command]
pub fn provider_exists(external_id_type: String, external_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::exists(&conn, &external_id_type, &external_id)
}

#[command]
pub fn get_provider_by_external_id(external_id_type: String, external_id: String, db: State<'_, Database>) -> Result<Option<Provider>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::get_by_external_id(&conn, &external_id_type, &external_id)
}

#[command]
pub fn create_provider(provider: Provider, db: State<'_, Database>) -> Result<Provider, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::create(&conn, &provider)
}

#[command]
pub fn delete_provider(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::providers::delete(&conn, &id)
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
// STICKER TYPES (formerly BLUEPRINT TYPES/TEMPLATE TYPES)
// ============================================================================

#[command]
pub fn get_all_sticker_types(db: State<'_, Database>) -> Result<Vec<StickerTypeEntity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::get_all(&conn)
}

#[command]
pub fn get_sticker_type(id: String, db: State<'_, Database>) -> Result<Option<StickerTypeEntity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::get_by_id(&conn, &id)
}

#[command]
pub fn get_sticker_types_by_category(category: String, db: State<'_, Database>) -> Result<Vec<StickerTypeEntity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::get_by_category(&conn, &category)
}

#[command]
pub fn get_sticker_types_by_source_type(source_type: String, db: State<'_, Database>) -> Result<Vec<StickerTypeEntity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::get_by_source_type(&conn, &source_type)
}

#[command]
pub fn create_sticker_type(sticker_type: StickerTypeEntity, db: State<'_, Database>) -> Result<StickerTypeEntity, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::create(&conn, &sticker_type)
}

#[command]
pub fn update_sticker_type(sticker_type: StickerTypeEntity, db: State<'_, Database>) -> Result<StickerTypeEntity, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::update(&conn, &sticker_type)
}

#[command]
pub fn delete_sticker_type(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::sticker_types::delete(&conn, &id)
}

// ============================================================================
// TAGS
// ============================================================================

#[command]
pub fn get_all_tags(db: State<'_, Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_all(&conn)
}

#[command]
pub fn get_tag(id: String, db: State<'_, Database>) -> Result<Option<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_by_id(&conn, &id)
}

#[command]
pub fn get_tags_by_key(key: String, db: State<'_, Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_by_key(&conn, &key)
}

#[command]
pub fn create_tag(tag: Tag, db: State<'_, Database>) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::create(&conn, &tag)
}

#[command]
pub fn update_tag(tag: Tag, db: State<'_, Database>) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::update(&conn, &tag)
}

#[command]
pub fn delete_tag(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::delete(&conn, &id)
}

// ============================================================================
// STICKER TAGS (formerly BLUEPRINT TAGS/TEMPLATE TAGS)
// ============================================================================

#[command]
pub fn get_tags_by_sticker(sticker_id: String, db: State<'_, Database>) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_by_sticker_id(&conn, &sticker_id)
}

#[command]
pub fn add_tag_to_sticker(sticker_id: String, tag_id: String, db: State<'_, Database>) -> Result<StickerTag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::add_tag_to_sticker(&conn, &sticker_id, &tag_id)
}

#[command]
pub fn remove_tag_from_sticker(sticker_id: String, tag_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::remove_tag_from_sticker(&conn, &sticker_id, &tag_id)
}

#[command]
pub fn get_sticker_ids_by_tag(tag_id: String, db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_sticker_ids_by_tag_id(&conn, &tag_id)
}

#[command]
pub fn get_sticker_names_by_imdb_ids(imdb_ids: Vec<String>, db: State<'_, Database>) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_sticker_names_by_tag_values(&conn, "imdb_id", &imdb_ids)
}

#[command]
pub fn get_pokemon_common_tag_keys(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_pokemon_common_tag_keys(&conn)
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
pub fn get_questions_by_source(source_id: String, db: State<'_, Database>) -> Result<Vec<Question>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::get_by_source_id(&conn, &source_id)
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
pub fn delete_questions_by_source(source_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::questions::delete_by_source_id(&conn, &source_id)
}

// ============================================================================
// COLLECTIONS
// ============================================================================

#[command]
pub fn get_all_collections(db: State<'_, Database>) -> Result<Vec<Collection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::get_all(&conn)
}

#[command]
pub fn get_collection(id: String, db: State<'_, Database>) -> Result<Option<Collection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::get_by_id(&conn, &id)
}

#[command]
pub fn create_collection(collection: Collection, db: State<'_, Database>) -> Result<Collection, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::create(&conn, &collection)
}

#[command]
pub fn update_collection(collection: Collection, db: State<'_, Database>) -> Result<Collection, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::update(&conn, &collection)
}

#[command]
pub fn delete_collection(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::delete(&conn, &id)
}

#[command]
pub fn add_sticker_to_collection(
    collection_id: String,
    sticker_id: String,
    sort_order: i32,
    db: State<'_, Database>,
) -> Result<CollectionSticker, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::add_sticker_to_collection(&conn, &collection_id, &sticker_id, sort_order)
}

#[command]
pub fn remove_sticker_from_collection(
    collection_id: String,
    sticker_id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::remove_sticker_from_collection(&conn, &collection_id, &sticker_id)
}

#[command]
pub fn get_stickers_for_collection(
    collection_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Sticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::get_stickers_for_collection(&conn, &collection_id)
}

#[command]
pub fn get_collections_by_type(
    collection_type_id: String,
    db: State<'_, Database>,
) -> Result<Vec<Collection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collections::get_by_type(&conn, &collection_type_id)
}

// ============================================================================
// COLLECTION TYPES
// ============================================================================

#[command]
pub fn get_all_collection_types(db: State<'_, Database>) -> Result<Vec<CollectionType>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collection_types::get_all(&conn)
}

#[command]
pub fn get_collection_type(id: String, db: State<'_, Database>) -> Result<Option<CollectionType>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collection_types::get_by_id(&conn, &id)
}

#[command]
pub fn create_collection_type(collection_type: CollectionType, db: State<'_, Database>) -> Result<CollectionType, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collection_types::create(&conn, &collection_type)
}

#[command]
pub fn update_collection_type(collection_type: CollectionType, db: State<'_, Database>) -> Result<CollectionType, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collection_types::update(&conn, &collection_type)
}

#[command]
pub fn delete_collection_type(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::collection_types::delete(&conn, &id)
}

// ============================================================================
// DATABASE INTROSPECTION
// ============================================================================

use serde_json::Value as JsonValue;

/// Get all table names from the database schema
#[command]
pub fn get_database_tables(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        row.get::<_, String>(0)
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Table info for a column
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableColumn {
    pub cid: i32,
    pub name: String,
    pub column_type: String,
    pub notnull: bool,
    pub pk: bool,
}

/// Get column info for a table
#[command]
pub fn get_table_columns(table_name: String, db: State<'_, Database>) -> Result<Vec<TableColumn>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate table name to prevent SQL injection
    let valid_tables: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    if !valid_tables.contains(&table_name) {
        return Err(format!("Invalid table name: {}", table_name));
    }

    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(TableColumn {
            cid: row.get(0)?,
            name: row.get(1)?,
            column_type: row.get::<_, String>(2).unwrap_or_default(),
            notnull: row.get::<_, i32>(3).unwrap_or(0) == 1,
            pk: row.get::<_, i32>(5).unwrap_or(0) == 1,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Table data result with column info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableData {
    pub columns: Vec<TableColumn>,
    pub rows: Vec<Vec<JsonValue>>,
    pub total_count: i64,
}

/// Get data from a specific table with pagination
#[command]
pub fn get_table_data(
    table_name: String,
    limit: Option<i64>,
    offset: Option<i64>,
    db: State<'_, Database>
) -> Result<TableData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate table name to prevent SQL injection
    let valid_tables: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    if !valid_tables.contains(&table_name) {
        return Err(format!("Invalid table name: {}", table_name));
    }

    // Get columns
    let columns: Vec<TableColumn> = {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))
            .map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            Ok(TableColumn {
                cid: row.get(0)?,
                name: row.get(1)?,
                column_type: row.get::<_, String>(2).unwrap_or_default(),
                notnull: row.get::<_, i32>(3).unwrap_or(0) == 1,
                pk: row.get::<_, i32>(5).unwrap_or(0) == 1,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // Get total count
    let total_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM {}", table_name),
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    // Get data with pagination
    let limit_val = limit.unwrap_or(100);
    let offset_val = offset.unwrap_or(0);

    let query = format!(
        "SELECT * FROM {} LIMIT {} OFFSET {}",
        table_name, limit_val, offset_val
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let column_count = columns.len();

    let rows_iter = stmt.query_map([], |row| {
        let mut row_data: Vec<JsonValue> = Vec::with_capacity(column_count);
        for i in 0..column_count {
            let value: JsonValue = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => JsonValue::Null,
                Ok(rusqlite::types::ValueRef::Integer(i)) => JsonValue::Number(i.into()),
                Ok(rusqlite::types::ValueRef::Real(f)) => {
                    serde_json::Number::from_f64(f)
                        .map(JsonValue::Number)
                        .unwrap_or(JsonValue::Null)
                }
                Ok(rusqlite::types::ValueRef::Text(s)) => {
                    JsonValue::String(String::from_utf8_lossy(s).to_string())
                }
                Ok(rusqlite::types::ValueRef::Blob(b)) => {
                    JsonValue::String(format!("[BLOB: {} bytes]", b.len()))
                }
                Err(_) => JsonValue::Null,
            };
            row_data.push(value);
        }
        Ok(row_data)
    }).map_err(|e| e.to_string())?;

    let rows: Vec<Vec<JsonValue>> = rows_iter
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(TableData {
        columns,
        rows,
        total_count,
    })
}

// ============================================================================
// USER STICKERS (user-owned stickers, stored in _user_stickers)
// ============================================================================

#[command]
pub fn get_all_user_stickers(db: State<'_, Database>) -> Result<Vec<UserSticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_all(&conn)
}

#[command]
pub fn get_user_stickers_by_source(source_id: String, db: State<'_, Database>) -> Result<Vec<UserSticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_by_source_id(&conn, &source_id)
}

#[command]
pub fn get_user_sticker(id: String, db: State<'_, Database>) -> Result<Option<UserSticker>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_by_id(&conn, &id)
}

#[command]
pub fn user_owns_sticker(sticker_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::owns_sticker(&conn, &sticker_id)
}

#[command]
pub fn get_user_sticker_copy_count(sticker_id: String, db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_copy_count(&conn, &sticker_id)
}

#[command]
pub fn get_user_unique_sticker_count_by_source(source_id: String, db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_unique_count_by_source(&conn, &source_id)
}

#[command]
pub fn get_user_owned_sticker_ids(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_owned_sticker_ids(&conn)
}

#[command]
pub fn acquire_user_sticker(user_sticker: UserSticker, db: State<'_, Database>) -> Result<UserSticker, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::create(&conn, &user_sticker)
}

#[command]
pub fn release_user_sticker(sticker_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::delete_by_sticker_id(&conn, &sticker_id)
}

#[command]
pub fn delete_user_sticker(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::delete(&conn, &id)
}

#[command]
pub fn delete_user_stickers_by_source(source_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::delete_by_source_id(&conn, &source_id)
}

#[command]
pub fn delete_all_user_stickers(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::delete_all(&conn)
}

/// Result for mixable stickers query
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixableStickerInfo {
    pub sticker_id: String,
    pub rarity_id: String,
    pub count: i64,
}

#[command]
pub fn get_mixable_user_stickers(db: State<'_, Database>) -> Result<Vec<MixableStickerInfo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let results = queries::user_stickers::get_mixable_stickers(&conn)?;
    Ok(results
        .into_iter()
        .map(|(sticker_id, rarity_id, count)| MixableStickerInfo {
            sticker_id,
            rarity_id,
            count,
        })
        .collect())
}

#[command]
pub fn get_user_sticker_copy_count_by_rarity(
    sticker_id: String,
    rarity_id: String,
    db: State<'_, Database>,
) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::get_copy_count_by_rarity(&conn, &sticker_id, &rarity_id)
}

#[command]
pub fn mix_user_stickers(
    sticker_id: String,
    current_rarity_id: String,
    new_rarity_id: String,
    source_id: String,
    db: State<'_, Database>,
) -> Result<UserSticker, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_stickers::mix_stickers(&conn, &sticker_id, &current_rarity_id, &new_rarity_id, &source_id)
}

// ============================================================================
// USER COLLECTIONS (user collection progress, stored in _user_collections)
// ============================================================================

#[command]
pub fn get_all_user_collections(db: State<'_, Database>) -> Result<Vec<UserCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::get_all(&conn)
}

#[command]
pub fn get_user_collection(id: String, db: State<'_, Database>) -> Result<Option<UserCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::get_by_id(&conn, &id)
}

#[command]
pub fn get_user_collection_by_collection_id(collection_id: String, db: State<'_, Database>) -> Result<Option<UserCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::get_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn get_completed_user_collections(db: State<'_, Database>) -> Result<Vec<UserCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::get_completed(&conn)
}

#[command]
pub fn get_in_progress_user_collections(db: State<'_, Database>) -> Result<Vec<UserCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::get_in_progress(&conn)
}

#[command]
pub fn create_user_collection(user_collection: UserCollection, db: State<'_, Database>) -> Result<UserCollection, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::create(&conn, &user_collection)
}

#[command]
pub fn update_user_collection(user_collection: UserCollection, db: State<'_, Database>) -> Result<UserCollection, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::update(&conn, &user_collection)
}

#[command]
pub fn mark_user_collection_completed(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::mark_completed(&conn, &collection_id)
}

#[command]
pub fn delete_user_collection(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::delete(&conn, &id)
}

#[command]
pub fn delete_user_collection_by_collection_id(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::delete_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn delete_all_user_collections(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collections::delete_all(&conn)
}

// ============================================================================
// USER SOURCES (user-owned sources, stored in _user_sources)
// ============================================================================

#[command]
pub fn get_all_user_sources(db: State<'_, Database>) -> Result<Vec<UserSource>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::get_all(&conn)
}

#[command]
pub fn get_user_source(id: String, db: State<'_, Database>) -> Result<Option<UserSource>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::get_by_id(&conn, &id)
}

#[command]
pub fn user_owns_source(source_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::owns_source(&conn, &source_id)
}

#[command]
pub fn get_user_owned_source_ids(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::get_owned_source_ids(&conn)
}

#[command]
pub fn acquire_user_source(user_source: UserSource, db: State<'_, Database>) -> Result<UserSource, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::create(&conn, &user_source)
}

#[command]
pub fn release_user_source(source_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::delete_by_source_id(&conn, &source_id)
}

#[command]
pub fn delete_user_source(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::delete(&conn, &id)
}

#[command]
pub fn delete_all_user_sources(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sources::delete_all(&conn)
}

// ============================================================================
// USER PLACED STAMPS (stamps placed on album pages, stored in _user_placed_stamps)
// ============================================================================

#[command]
pub fn get_placed_stamps_by_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserPlacedStamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::get_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn get_placed_stamps_by_page(collection_id: String, page_index: i32, db: State<'_, Database>) -> Result<Vec<UserPlacedStamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::get_by_collection_page(&conn, &collection_id, page_index)
}

#[command]
pub fn get_placed_stamp(id: String, db: State<'_, Database>) -> Result<Option<UserPlacedStamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::get_by_id(&conn, &id)
}

#[command]
pub fn place_stamp(placed_stamp: UserPlacedStamp, db: State<'_, Database>) -> Result<UserPlacedStamp, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::create(&conn, &placed_stamp)
}

#[command]
pub fn update_placed_stamp(placed_stamp: UserPlacedStamp, db: State<'_, Database>) -> Result<UserPlacedStamp, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::update(&conn, &placed_stamp)
}

#[command]
pub fn remove_placed_stamp(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::delete(&conn, &id)
}

#[command]
pub fn clear_collection_stamps(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::delete_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn clear_all_placed_stamps(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_stamps::delete_all(&conn)
}

// ============================================================================
// USER STICKER PLACEMENTS (stickers "stuck" in albums, stored in _user_sticker_placements)
// ============================================================================

#[command]
pub fn get_sticker_placements_by_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserStickerPlacement>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::get_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn get_all_placed_sticker_ids(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::get_all_placed_sticker_ids(&conn)
}

#[command]
pub fn get_placed_sticker_ids_for_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::get_placed_sticker_ids_for_collection(&conn, &collection_id)
}

#[command]
pub fn is_sticker_placed(sticker_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::is_sticker_placed(&conn, &sticker_id)
}

#[command]
pub fn place_sticker(placement: UserStickerPlacement, db: State<'_, Database>) -> Result<UserStickerPlacement, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::create(&conn, &placement)
}

#[command]
pub fn unstick_sticker(sticker_id: String, collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::delete_by_sticker_collection(&conn, &sticker_id, &collection_id)
}

#[command]
pub fn clear_collection_sticker_placements(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::delete_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn clear_all_sticker_placements(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::delete_all(&conn)
}

// ============================================================================
// LLM CONFIGS
// ============================================================================

#[command]
pub fn get_all_llm_configs(db: State<'_, Database>) -> Result<Vec<LlmConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::get_all(&conn)
}

#[command]
pub fn get_llm_config(id: String, db: State<'_, Database>) -> Result<Option<LlmConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::get_by_id(&conn, &id)
}

#[command]
pub fn get_default_llm_config(db: State<'_, Database>) -> Result<Option<LlmConfig>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::get_default(&conn)
}

#[command]
pub fn create_llm_config(llm_config: LlmConfig, db: State<'_, Database>) -> Result<LlmConfig, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::create(&conn, &llm_config)
}

#[command]
pub fn update_llm_config(llm_config: LlmConfig, db: State<'_, Database>) -> Result<LlmConfig, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::update(&conn, &llm_config)
}

#[command]
pub fn delete_llm_config(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::delete(&conn, &id)
}

#[command]
pub fn set_default_llm_config(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::llm_configs::set_default(&conn, &id)
}

// ============================================================================
// STAMP PACKS (imported sticker packs - WhatsApp, Telegram, etc.)
// ============================================================================

#[command]
pub fn get_all_stamp_packs(db: State<'_, Database>) -> Result<Vec<StampPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::get_all(&conn)
}

#[command]
pub fn get_stamp_packs_by_source(source: String, db: State<'_, Database>) -> Result<Vec<StampPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::get_by_source(&conn, &source)
}

#[command]
pub fn get_stamp_pack(id: String, db: State<'_, Database>) -> Result<Option<StampPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::get_by_id(&conn, &id)
}

#[command]
pub fn create_stamp_pack(stamp_pack: StampPack, db: State<'_, Database>) -> Result<StampPack, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::create(&conn, &stamp_pack)
}

#[command]
pub fn update_stamp_pack(stamp_pack: StampPack, db: State<'_, Database>) -> Result<StampPack, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::update(&conn, &stamp_pack)
}

#[command]
pub fn delete_stamp_pack(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamp_packs::delete(&conn, &id)
}

// ============================================================================
// STAMPS (individual stickers within a stamp pack)
// ============================================================================

#[command]
pub fn get_all_stamps(db: State<'_, Database>) -> Result<Vec<Stamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::get_all(&conn)
}

#[command]
pub fn get_stamps_by_pack(pack_id: String, db: State<'_, Database>) -> Result<Vec<Stamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::get_by_pack_id(&conn, &pack_id)
}

#[command]
pub fn get_stamp(id: String, db: State<'_, Database>) -> Result<Option<Stamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::get_by_id(&conn, &id)
}

#[command]
pub fn create_stamp(stamp: Stamp, db: State<'_, Database>) -> Result<Stamp, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::create(&conn, &stamp)
}

#[command]
pub fn create_stamps_batch(stamps: Vec<Stamp>, db: State<'_, Database>) -> Result<Vec<Stamp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::create_batch(&conn, &stamps)
}

#[command]
pub fn delete_stamp(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::delete(&conn, &id)
}

#[command]
pub fn delete_stamps_by_pack(pack_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::stamps::delete_by_pack_id(&conn, &pack_id)
}

// ============================================================================
// STAMP IMPORT (import sticker packs and copy to app data dir)
// ============================================================================

use tauri::AppHandle;

/// Get the stamps data directory (app_data_dir/stamps)
#[command]
pub fn get_stamps_data_dir(app: AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let stamps_dir = data_dir.join("stamps");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&stamps_dir)
        .map_err(|e| format!("Failed to create stamps directory: {}", e))?;

    Ok(stamps_dir.to_string_lossy().to_string())
}

/// Copy a file to the stamps data directory
#[command]
pub fn copy_file_to_stamps_dir(app: AppHandle, source_path: String, dest_filename: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let stamps_dir = data_dir.join("stamps");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&stamps_dir)
        .map_err(|e| format!("Failed to create stamps directory: {}", e))?;

    let dest_path = stamps_dir.join(&dest_filename);

    std::fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// Write binary data to the stamps data directory
#[command]
pub fn write_stamp_file(app: AppHandle, pack_id: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let pack_dir = data_dir.join("stamps").join(&pack_id);

    // Create pack directory if it doesn't exist
    std::fs::create_dir_all(&pack_dir)
        .map_err(|e| format!("Failed to create pack directory: {}", e))?;

    let file_path = pack_dir.join(&filename);

    std::fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Return relative path from stamps dir
    Ok(format!("{}/{}", pack_id, filename))
}

/// Delete a stamp pack's files from the stamps data directory
#[command]
pub fn delete_stamp_pack_files(app: AppHandle, pack_id: String) -> Result<bool, String> {
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let pack_dir = data_dir.join("stamps").join(&pack_id);

    if pack_dir.exists() {
        std::fs::remove_dir_all(&pack_dir)
            .map_err(|e| format!("Failed to delete pack directory: {}", e))?;
    }

    Ok(true)
}

// ============================================================================
// CLEAR ALL USER DATA
// ============================================================================

/// Result of clearing all user data
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearUserDataResult {
    pub user_stickers_deleted: i64,
    pub user_collections_deleted: i64,
    pub user_sources_deleted: i64,
    pub placed_stamps_deleted: i64,
    pub sticker_placements_deleted: i64,
}

/// Clear all user data from all _user tables
#[command]
pub fn clear_all_user_data(db: State<'_, Database>) -> Result<ClearUserDataResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Delete in order to respect any potential foreign key constraints
    let sticker_placements_deleted = queries::user_sticker_placements::delete_all(&conn)?;
    let placed_stamps_deleted = queries::user_placed_stamps::delete_all(&conn)?;
    let user_stickers_deleted = queries::user_stickers::delete_all(&conn)?;
    let user_collections_deleted = queries::user_collections::delete_all(&conn)?;
    let user_sources_deleted = queries::user_sources::delete_all(&conn)?;

    Ok(ClearUserDataResult {
        user_stickers_deleted,
        user_collections_deleted,
        user_sources_deleted,
        placed_stamps_deleted,
        sticker_placements_deleted,
    })
}

// ============================================================================
// UTILITY
// ============================================================================

/// Get current working directory (useful for development)
#[command]
pub fn get_cwd() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get cwd: {}", e))
}

// ============================================================================
// COLLECTION EXPORT
// ============================================================================

use crate::image_cache::cache::{build_cache_path, fetch_and_save_async, ImageCacheState};

/// Result of preparing a collection export
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareExportResult {
    pub export_dir: String,
    pub collection_json_path: String,
    pub stickers_copied: usize,
    pub stickers_fetched: usize,
    pub stickers_missing: usize,
}

/// Prepare a collection export by copying cached images and writing collection.json
#[command]
pub async fn prepare_collection_export(
    collection_id: String,
    app: AppHandle,
    db: State<'_, Database>,
    cache_state: State<'_, ImageCacheState>,
) -> Result<PrepareExportResult, String> {
    // Get all data from DB first, then release the lock before async operations
    let (collection, stickers, sticker_tags) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;

        // Get collection
        let collection = queries::collections::get_by_id(&conn, &collection_id)?
            .ok_or_else(|| format!("Collection not found: {}", collection_id))?;

        // Get stickers for collection
        let stickers = queries::collections::get_stickers_for_collection(&conn, &collection_id)?;

        // Fetch tags for all stickers
        let sticker_ids: Vec<String> = stickers.iter().map(|s| s.id.clone()).collect();
        let sticker_tags = queries::tags::get_tags_for_stickers(&conn, &sticker_ids)?;

        (collection, stickers, sticker_tags)
    }; // Lock is released here

    // Create export directory
    let data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Sanitize collection title for directory name
    let dir_name = collection.title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>();
    let dir_name = dir_name.trim_matches('-');

    let export_dir = data_dir.join("exports").join(format!("{}-{}", dir_name, &collection_id[..8.min(collection_id.len())]));
    let stickers_dir = export_dir.join("stickers");

    // Create directories
    std::fs::create_dir_all(&stickers_dir)
        .map_err(|e| format!("Failed to create export directory: {}", e))?;

    let mut stickers_copied = 0;
    let mut stickers_fetched = 0;
    let mut stickers_missing = 0;

    // Track local filenames for each sticker
    let mut sticker_local_images: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    // Copy each sticker's cached image (fetch if not cached)
    for sticker in &stickers {
        if !sticker.image.is_empty() {
            let mut cache_path = build_cache_path(&cache_state.cache_dir, &sticker.image);
            let mut was_fetched = false;

            // If not cached, try to fetch and cache it asynchronously
            if !cache_path.exists() {
                match fetch_and_save_async(&sticker.image, &cache_state.cache_dir).await {
                    Ok(cached) => {
                        cache_path = std::path::PathBuf::from(&cached.local_path);
                        was_fetched = true;
                    }
                    Err(e) => {
                        log::warn!("Failed to fetch image for sticker {}: {}", sticker.id, e);
                        stickers_missing += 1;
                        continue;
                    }
                }
            }

            if cache_path.exists() {
                // Get extension from cached file
                let ext = cache_path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("jpg");

                // Use sticker id as filename
                let dest_filename = format!("{}.{}", sticker.id, ext);
                let dest_path = stickers_dir.join(&dest_filename);

                if std::fs::copy(&cache_path, &dest_path).is_ok() {
                    if was_fetched {
                        stickers_fetched += 1;
                    } else {
                        stickers_copied += 1;
                    }
                    // Store the local filename (relative path within export)
                    sticker_local_images.insert(sticker.id.clone(), format!("stickers/{}", dest_filename));
                } else {
                    stickers_missing += 1;
                }
            } else {
                stickers_missing += 1;
            }
        } else {
            stickers_missing += 1;
        }
    }

    // Build a map of sticker_id -> tags
    let mut sticker_tags_map: std::collections::HashMap<String, Vec<Tag>> = std::collections::HashMap::new();
    for (sticker_id, tag) in sticker_tags {
        sticker_tags_map.entry(sticker_id).or_default().push(tag);
    }

    // Build export data structure with local image paths
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct StickerExport {
        #[serde(flatten)]
        sticker: Sticker,
        /// Local image path relative to export directory (e.g., "stickers/{id}.jpg")
        #[serde(skip_serializing_if = "Option::is_none")]
        local_image: Option<String>,
        tags: Vec<Tag>,
    }

    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct ExportData {
        collection: Collection,
        stickers: Vec<StickerExport>,
    }

    let stickers_export: Vec<StickerExport> = stickers
        .into_iter()
        .map(|sticker| {
            let tags = sticker_tags_map.remove(&sticker.id).unwrap_or_default();
            let local_image = sticker_local_images.remove(&sticker.id);
            StickerExport { sticker, local_image, tags }
        })
        .collect();

    let export_data = ExportData {
        collection: collection.clone(),
        stickers: stickers_export,
    };

    // Write collection.json
    let json_path = export_dir.join("collection.json");
    let json_content = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    std::fs::write(&json_path, &json_content)
        .map_err(|e| format!("Failed to write collection.json: {}", e))?;

    Ok(PrepareExportResult {
        export_dir: export_dir.to_string_lossy().to_string(),
        collection_json_path: json_path.to_string_lossy().to_string(),
        stickers_copied,
        stickers_fetched,
        stickers_missing,
    })
}

/// Result of creating a torrent file
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTorrentResult {
    pub torrent_path: String,
    pub info_hash: String,
}

/// Create a torrent file for an export directory
#[command]
pub async fn create_torrent_for_export(
    export_dir: String,
    torrent_name: Option<String>,
) -> Result<CreateTorrentResult, String> {
    use librqbit::{create_torrent, CreateTorrentOptions};
    use std::path::Path;

    let path = Path::new(&export_dir);
    if !path.exists() {
        return Err(format!("Export directory does not exist: {}", export_dir));
    }

    let options = CreateTorrentOptions {
        name: torrent_name.as_deref(),
        piece_length: None,
    };

    let result = create_torrent(path, options)
        .await
        .map_err(|e| format!("Failed to create torrent: {}", e))?;

    let torrent_bytes = result.as_bytes()
        .map_err(|e| format!("Failed to serialize torrent: {}", e))?;

    let info_hash = result.info_hash().as_string();

    // Write torrent file next to the export directory
    let torrent_path = path.with_extension("torrent");
    std::fs::write(&torrent_path, &torrent_bytes)
        .map_err(|e| format!("Failed to write torrent file: {}", e))?;

    Ok(CreateTorrentResult {
        torrent_path: torrent_path.to_string_lossy().to_string(),
        info_hash,
    })
}

// ============================================================================
// POKEMON TRIVIA TEMPLATES
// ============================================================================

#[command]
pub fn get_all_pokemon_trivia_templates(db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::get_all(&conn)
}

#[command]
pub fn get_pokemon_trivia_template(id: String, db: State<'_, Database>) -> Result<Option<PokemonTriviaTemplate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::get_by_id(&conn, &id)
}

#[command]
pub fn get_pokemon_trivia_templates_by_tag_key(tag_key: String, db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::get_by_tag_key(&conn, &tag_key)
}

#[command]
pub fn get_active_pokemon_trivia_templates(db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::get_active(&conn)
}

#[command]
pub fn get_pokemon_trivia_template_tag_keys(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::get_unique_tag_keys(&conn)
}

#[command]
pub fn create_pokemon_trivia_template(template: PokemonTriviaTemplate, db: State<'_, Database>) -> Result<PokemonTriviaTemplate, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::create(&conn, &template)
}

#[command]
pub fn update_pokemon_trivia_template(template: PokemonTriviaTemplate, db: State<'_, Database>) -> Result<PokemonTriviaTemplate, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::update(&conn, &template)
}

#[command]
pub fn delete_pokemon_trivia_template(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates::delete(&conn, &id)
}

/// Open a directory in the system file explorer
#[command]
pub fn open_directory(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}

