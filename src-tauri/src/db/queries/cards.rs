use rusqlite::{params, Connection};
use crate::models::{Card, CardType};

pub fn get_all(conn: &Connection) -> Result<Vec<Card>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, name, image, card_type, rarity_id, image_source,
                    musicbrainz_release_group_id, release_type, release_year,
                    added_at, created_at, updated_at
             FROM cards
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_card(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_album_id(conn: &Connection, album_id: &str) -> Result<Vec<Card>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, name, image, card_type, rarity_id, image_source,
                    musicbrainz_release_group_id, release_type, release_year,
                    added_at, created_at, updated_at
             FROM cards
             WHERE album_id = ?1
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![album_id], |row| Ok(row_to_card(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Card>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_id, name, image, card_type, rarity_id, image_source,
                    musicbrainz_release_group_id, release_type, release_year,
                    added_at, created_at, updated_at
             FROM cards
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_card(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, card: &Card) -> Result<Card, String> {
    let id = if card.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        card.id.clone()
    };

    let now = chrono_now();
    let card_type_str = card.card_type.to_string();

    conn.execute(
        "INSERT INTO cards (
            id, album_id, name, image, card_type, rarity_id, image_source,
            musicbrainz_release_group_id, release_type, release_year,
            added_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            card.album_id,
            card.name,
            card.image,
            card_type_str,
            card.rarity_id,
            card.image_source,
            card.musicbrainz_release_group_id,
            card.release_type,
            card.release_year,
            card.added_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Card {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..card.clone()
    })
}

pub fn update(conn: &Connection, card: &Card) -> Result<Card, String> {
    let now = chrono_now();
    let card_type_str = card.card_type.to_string();

    conn.execute(
        "UPDATE cards SET
            album_id = ?2, name = ?3, image = ?4, card_type = ?5, rarity_id = ?6, image_source = ?7,
            musicbrainz_release_group_id = ?8, release_type = ?9, release_year = ?10,
            added_at = ?11, updated_at = ?12
         WHERE id = ?1",
        params![
            card.id,
            card.album_id,
            card.name,
            card.image,
            card_type_str,
            card.rarity_id,
            card.image_source,
            card.musicbrainz_release_group_id,
            card.release_type,
            card.release_year,
            card.added_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Card {
        updated_at: now,
        ..card.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM cards WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

pub fn delete_by_album_id(conn: &Connection, album_id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM cards WHERE album_id = ?1", params![album_id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_card(row: &rusqlite::Row) -> Card {
    let card_type_str: String = row.get(4).unwrap_or_default();
    Card {
        id: row.get(0).unwrap_or_default(),
        album_id: row.get(1).unwrap_or_default(),
        name: row.get(2).unwrap_or_default(),
        image: row.get(3).unwrap_or_default(),
        card_type: CardType::from_str(&card_type_str),
        rarity_id: row.get(5).unwrap_or(None),
        image_source: row.get(6).unwrap_or(None),
        musicbrainz_release_group_id: row.get(7).unwrap_or(None),
        release_type: row.get(8).unwrap_or(None),
        release_year: row.get(9).unwrap_or(None),
        added_at: row.get(10).unwrap_or(None),
        created_at: row.get(11).unwrap_or_default(),
        updated_at: row.get(12).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
