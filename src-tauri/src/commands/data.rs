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

#[command]
pub fn get_random_pokemon_with_tags(db: State<'_, Database>) -> Result<Option<queries::tags::PokemonWithTags>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_random_pokemon_with_tags(&conn)
}

#[command]
pub fn get_random_pokemon_by_generation(
    generation: String,
    exclude_id: String,
    limit: usize,
    db: State<'_, Database>
) -> Result<Vec<queries::tags::PokemonWithTags>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::tags::get_random_pokemon_by_generation(&conn, &generation, &exclude_id, limit)
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

#[command]
pub fn get_sticker_placement_count(sticker_id: String, db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::get_placement_count(&conn, &sticker_id)
}

#[command]
pub fn get_all_sticker_placement_counts(db: State<'_, Database>) -> Result<Vec<(String, i64)>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_sticker_placements::get_all_placement_counts(&conn)
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
// USER PLAYER (singleton player profile, stored in _user_player)
// ============================================================================

#[command]
pub fn get_user_player(db: State<'_, Database>) -> Result<UserPlayer, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_player::get(&conn)
}

#[command]
pub fn update_user_player(player: UserPlayer, db: State<'_, Database>) -> Result<UserPlayer, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_player::update(&conn, &player)
}

#[command]
pub fn add_user_experience(amount: i64, db: State<'_, Database>) -> Result<UserPlayer, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_player::add_experience(&conn, amount)
}

#[command]
pub fn set_user_player_name(name: String, db: State<'_, Database>) -> Result<UserPlayer, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_player::set_name(&conn, &name)
}

#[command]
pub fn reset_user_player(db: State<'_, Database>) -> Result<UserPlayer, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_player::reset(&conn)
}

// ============================================================================
// USER GAME STATS (per-game statistics, stored in _user_game_stats)
// ============================================================================

#[command]
pub fn get_all_user_game_stats(db: State<'_, Database>) -> Result<Vec<UserGameStats>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::get_all(&conn)
}

#[command]
pub fn get_user_game_stats(game_type: String, db: State<'_, Database>) -> Result<Option<UserGameStats>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::get_by_game_type(&conn, &game_type)
}

#[command]
pub fn get_or_create_user_game_stats(game_type: String, db: State<'_, Database>) -> Result<UserGameStats, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::get_or_create(&conn, &game_type)
}

#[command]
pub fn update_user_game_stats(stats: UserGameStats, db: State<'_, Database>) -> Result<UserGameStats, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::update(&conn, &stats)
}

#[command]
pub fn record_user_game(
    game_type: String,
    score: i64,
    correct: i64,
    wrong: i64,
    streak: i64,
    db: State<'_, Database>,
) -> Result<UserGameStats, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::record_game(&conn, &game_type, score, correct, wrong, streak)
}

#[command]
pub fn delete_user_game_stats(game_type: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::delete_by_game_type(&conn, &game_type)
}

#[command]
pub fn delete_all_user_game_stats(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_game_stats::delete_all(&conn)
}

// ============================================================================
// USER PLACED ICONS (icons placed on album pages, stored in _user_placed_icons)
// ============================================================================

#[command]
pub fn get_placed_icons_by_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserPlacedIcon>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::get_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn get_placed_icons_by_page(collection_id: String, page_index: i32, db: State<'_, Database>) -> Result<Vec<UserPlacedIcon>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::get_by_collection_page(&conn, &collection_id, page_index)
}

#[command]
pub fn get_placed_icon(id: String, db: State<'_, Database>) -> Result<Option<UserPlacedIcon>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::get_by_id(&conn, &id)
}

#[command]
pub fn place_icon(placed_icon: UserPlacedIcon, db: State<'_, Database>) -> Result<UserPlacedIcon, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::create(&conn, &placed_icon)
}

#[command]
pub fn update_placed_icon(placed_icon: UserPlacedIcon, db: State<'_, Database>) -> Result<UserPlacedIcon, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::update(&conn, &placed_icon)
}

#[command]
pub fn remove_placed_icon(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::delete(&conn, &id)
}

#[command]
pub fn clear_collection_icons(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::delete_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn clear_all_placed_icons(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_placed_icons::delete_all(&conn)
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
    pub placed_icons_deleted: i64,
    pub game_stats_deleted: i64,
    pub booster_packs_deleted: i64,
    pub collection_rewards_deleted: i64,
    pub player_reset: bool,
}

/// Clear all user data from all _user tables
#[command]
pub fn clear_all_user_data(db: State<'_, Database>) -> Result<ClearUserDataResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Delete in order to respect any potential foreign key constraints
    let sticker_placements_deleted = queries::user_sticker_placements::delete_all(&conn)?;
    let placed_stamps_deleted = queries::user_placed_stamps::delete_all(&conn)?;
    let placed_icons_deleted = queries::user_placed_icons::delete_all(&conn)?;
    let user_stickers_deleted = queries::user_stickers::delete_all(&conn)?;
    let user_collections_deleted = queries::user_collections::delete_all(&conn)?;
    let user_sources_deleted = queries::user_sources::delete_all(&conn)?;
    let game_stats_deleted = queries::user_game_stats::delete_all(&conn)?;
    let booster_packs_deleted = queries::user_booster_packs::delete_all(&conn)?;
    let collection_rewards_deleted = queries::user_collection_rewards::delete_all(&conn)?;
    let player_reset = queries::user_player::reset(&conn).is_ok();

    Ok(ClearUserDataResult {
        user_stickers_deleted,
        user_collections_deleted,
        user_sources_deleted,
        placed_stamps_deleted,
        sticker_placements_deleted,
        placed_icons_deleted,
        game_stats_deleted,
        booster_packs_deleted,
        collection_rewards_deleted,
        player_reset,
    })
}

// ============================================================================
// USER BOOSTER PACKS (booster packs earned from games, stored in _user_booster_packs)
// ============================================================================

#[command]
pub fn get_all_user_booster_packs(db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::get_all(&conn)
}

#[command]
pub fn get_unopened_user_booster_packs(db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::get_unopened(&conn)
}

#[command]
pub fn get_unopened_user_booster_packs_by_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::get_unopened_by_collection(&conn, &collection_id)
}

#[command]
pub fn get_user_booster_packs_by_collection(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::get_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn get_user_booster_pack(id: String, db: State<'_, Database>) -> Result<Option<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::get_by_id(&conn, &id)
}

#[command]
pub fn count_unopened_user_booster_packs(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::count_unopened(&conn)
}

#[command]
pub fn count_unopened_user_booster_packs_by_collection(collection_id: String, db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::count_unopened_by_collection(&conn, &collection_id)
}

#[command]
pub fn award_user_booster_pack(booster_pack: UserBoosterPack, db: State<'_, Database>) -> Result<UserBoosterPack, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::create(&conn, &booster_pack)
}

#[command]
pub fn award_user_booster_packs_batch(count: i64, collection_id: String, earned_from: String, db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::create_batch(&conn, count, &collection_id, &earned_from)
}

#[command]
pub fn open_user_booster_pack(id: String, db: State<'_, Database>) -> Result<UserBoosterPack, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::mark_opened(&conn, &id)
}

#[command]
pub fn open_user_booster_packs_batch(collection_id: String, count: i64, db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::mark_opened_batch(&conn, &collection_id, count)
}

#[command]
pub fn delete_user_booster_pack(id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::delete(&conn, &id)
}

#[command]
pub fn delete_user_booster_packs_by_collection(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::delete_by_collection_id(&conn, &collection_id)
}

#[command]
pub fn delete_all_user_booster_packs(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_booster_packs::delete_all(&conn)
}

/// Result for unopened booster packs summary
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoosterPackSummary {
    pub collection_id: String,
    pub count: i64,
}

#[command]
pub fn get_unopened_user_booster_packs_summary(db: State<'_, Database>) -> Result<Vec<BoosterPackSummary>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let results = queries::user_booster_packs::get_unopened_summary(&conn)?;
    Ok(results
        .into_iter()
        .map(|(collection_id, count)| BoosterPackSummary {
            collection_id,
            count,
        })
        .collect())
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
// POKEMON TRIVIA TEMPLATES V2 (enhanced with 9 template types)
// ============================================================================

#[command]
pub fn get_all_pokemon_trivia_templates_v2(db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_all(&conn)
}

#[command]
pub fn get_pokemon_trivia_template_v2(id: String, db: State<'_, Database>) -> Result<Option<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_by_id(&conn, &id)
}

#[command]
pub fn get_pokemon_trivia_templates_v2_by_type(template_type: String, db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_by_template_type(&conn, &template_type)
}

#[command]
pub fn get_pokemon_trivia_templates_v2_by_attribute(primary_attribute: String, db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_by_primary_attribute(&conn, &primary_attribute)
}

#[command]
pub fn get_active_pokemon_trivia_templates_v2(db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_active(&conn)
}

#[command]
pub fn get_pokemon_trivia_templates_v2_by_difficulty(difficulty: String, db: State<'_, Database>) -> Result<Vec<PokemonTriviaTemplateV2>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_by_difficulty(&conn, &difficulty)
}

#[command]
pub fn get_pokemon_trivia_template_v2_types(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_unique_template_types(&conn)
}

#[command]
pub fn get_pokemon_trivia_template_v2_attributes(db: State<'_, Database>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::pokemon_trivia_templates_v2::get_unique_primary_attributes(&conn)
}

// ============================================================================
// USER COLLECTION REWARDS (time-based rewards for collections with stickers)
// ============================================================================

use crate::models::{UserCollectionReward, EligibleRewardCollection};

/// Get all collections where user has at least 1 sticker, with reward eligibility info
#[command]
pub fn get_eligible_reward_collections(db: State<'_, Database>) -> Result<Vec<EligibleRewardCollection>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collection_rewards::get_eligible_collections(&conn)
}

/// Get all user collection rewards (tracking records)
#[command]
pub fn get_all_user_collection_rewards(db: State<'_, Database>) -> Result<Vec<UserCollectionReward>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collection_rewards::get_all(&conn)
}

/// Get a user collection reward by collection ID
#[command]
pub fn get_user_collection_reward(collection_id: String, db: State<'_, Database>) -> Result<Option<UserCollectionReward>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collection_rewards::get_by_collection_id(&conn, &collection_id)
}

/// Claim all accumulated rewards for a collection - awards booster packs and updates the claim timestamp
/// Returns all the earned booster packs
#[command]
pub fn claim_collection_reward(collection_id: String, db: State<'_, Database>) -> Result<Vec<UserBoosterPack>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // First check if user can claim (has stickers and enough time passed)
    let eligible = queries::user_collection_rewards::get_eligible_collections(&conn)?;
    let collection_eligible = eligible.iter().find(|c| c.collection_id == collection_id);

    match collection_eligible {
        Some(ec) if ec.can_claim && ec.claimable_count > 0 => {
            // Update the claim timestamp
            queries::user_collection_rewards::claim_reward(&conn, &collection_id)?;

            // Award all accumulated booster packs
            let packs = queries::user_booster_packs::create_batch(&conn, ec.claimable_count, &collection_id, "timed-reward")?;

            Ok(packs)
        }
        Some(_) => Err("Reward not available yet - please wait for cooldown".to_string()),
        None => Err("Collection not eligible for rewards - need at least 1 sticker".to_string()),
    }
}

/// Delete a user collection reward by collection ID
#[command]
pub fn delete_user_collection_reward(collection_id: String, db: State<'_, Database>) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collection_rewards::delete_by_collection_id(&conn, &collection_id)
}

/// Delete all user collection rewards
#[command]
pub fn delete_all_user_collection_rewards(db: State<'_, Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    queries::user_collection_rewards::delete_all(&conn)
}

