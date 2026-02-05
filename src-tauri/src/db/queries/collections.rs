use rusqlite::{params, Connection};
use crate::models::{Collection, CollectionSticker, Sticker};

// ============================================================================
// COLLECTION CRUD OPERATIONS
// ============================================================================

pub fn get_all(conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_type_id, title, description, region, cover_image, created_at, updated_at
             FROM collections
             ORDER BY title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_type(conn: &Connection, collection_type_id: i64) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_type_id, title, description, region, cover_image, created_at, updated_at
             FROM collections
             WHERE collection_type_id = ?1
             ORDER BY title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_type_id], |row| Ok(row_to_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Option<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, collection_type_id, title, description, region, cover_image, created_at, updated_at
             FROM collections
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_collection(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, collection: &Collection) -> Result<Collection, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT INTO collections (collection_type_id, title, description, region, cover_image, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![collection.collection_type_id, collection.title, collection.description, collection.region, collection.cover_image, now, now],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Collection {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..collection.clone()
    })
}

pub fn update(conn: &Connection, collection: &Collection) -> Result<Collection, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE collections SET collection_type_id = ?2, title = ?3, description = ?4, region = ?5, cover_image = ?6, updated_at = ?7
         WHERE id = ?1",
        params![collection.id, collection.collection_type_id, collection.title, collection.description, collection.region, collection.cover_image, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Collection {
        updated_at: now,
        ..collection.clone()
    })
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM collections WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

// ============================================================================
// COLLECTION-STICKER RELATIONSHIP OPERATIONS
// ============================================================================

pub fn add_sticker_to_collection(
    conn: &Connection,
    collection_id: i64,
    sticker_id: i64,
    sort_order: i32,
) -> Result<CollectionSticker, String> {
    let now = chrono_now();

    conn.execute(
        "INSERT OR IGNORE INTO collection_stickers (collection_id, sticker_id, sort_order, added_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![collection_id, sticker_id, sort_order, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(CollectionSticker {
        collection_id,
        sticker_id,
        sort_order,
        added_at: now,
    })
}

pub fn remove_sticker_from_collection(
    conn: &Connection,
    collection_id: i64,
    sticker_id: i64,
) -> Result<bool, String> {
    let rows_affected = conn
        .execute(
            "DELETE FROM collection_stickers WHERE collection_id = ?1 AND sticker_id = ?2",
            params![collection_id, sticker_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn get_stickers_for_collection(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<Sticker>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.source_id, s.name, s.image, s.sticker_type_id,
                    s.image_source, s.width, s.height, s.fragment_of, s.fragment_position,
                    s.added_at, s.created_at, s.updated_at, src.title as source_name
             FROM stickers s
             INNER JOIN collection_stickers cs ON s.id = cs.sticker_id
             LEFT JOIN sources src ON s.source_id = src.id
             WHERE cs.collection_id = ?1
             ORDER BY cs.sort_order ASC, s.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| Ok(row_to_sticker_with_source(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_sticker_ids_for_collection(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<i64>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sticker_id FROM collection_stickers WHERE collection_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![collection_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_collections_for_sticker(
    conn: &Connection,
    sticker_id: i64,
) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.collection_type_id, c.title, c.description, c.region, c.cover_image, c.created_at, c.updated_at
             FROM collections c
             INNER JOIN collection_stickers cs ON c.id = cs.collection_id
             WHERE cs.sticker_id = ?1
             ORDER BY c.title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![sticker_id], |row| Ok(row_to_collection(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn row_to_collection(row: &rusqlite::Row) -> Collection {
    Collection {
        id: row.get(0).unwrap_or_default(),
        collection_type_id: row.get(1).unwrap_or(None),
        title: row.get(2).unwrap_or_default(),
        description: row.get(3).unwrap_or_default(),
        region: row.get(4).unwrap_or(None),
        cover_image: row.get(5).unwrap_or(None),
        created_at: row.get(6).unwrap_or_default(),
        updated_at: row.get(7).unwrap_or_default(),
    }
}

fn row_to_sticker(row: &rusqlite::Row) -> Sticker {
    Sticker {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        image: row.get(3).unwrap_or_default(),
        sticker_type_id: row.get(4).unwrap_or(None),
        image_source: row.get(5).unwrap_or(None),
        width: row.get(6).unwrap_or(None),
        height: row.get(7).unwrap_or(None),
        fragment_of: row.get(8).unwrap_or(None),
        fragment_position: row.get(9).unwrap_or(None),
        added_at: row.get(10).unwrap_or(None),
        created_at: row.get(11).unwrap_or_default(),
        updated_at: row.get(12).unwrap_or_default(),
        source_name: None,
    }
}

fn row_to_sticker_with_source(row: &rusqlite::Row) -> Sticker {
    Sticker {
        id: row.get(0).unwrap_or_default(),
        source_id: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        image: row.get(3).unwrap_or_default(),
        sticker_type_id: row.get(4).unwrap_or(None),
        image_source: row.get(5).unwrap_or(None),
        width: row.get(6).unwrap_or(None),
        height: row.get(7).unwrap_or(None),
        fragment_of: row.get(8).unwrap_or(None),
        fragment_position: row.get(9).unwrap_or(None),
        added_at: row.get(10).unwrap_or(None),
        created_at: row.get(11).unwrap_or_default(),
        updated_at: row.get(12).unwrap_or_default(),
        source_name: row.get(13).unwrap_or(None),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
