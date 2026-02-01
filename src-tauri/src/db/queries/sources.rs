use rusqlite::{params, Connection};
use crate::models::{Source, SourceType};

pub fn get_all(conn: &Connection) -> Result<Vec<Source>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_type, title, description, cover_image, wikia_url,
                    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
                    anilist_id, mal_id,
                    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
                    sport, league, country,
                    wikidata_id, scientific_name, conservation_status, taxonomic_class,
                    added_at, created_at, updated_at
             FROM sources
             ORDER BY title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_source(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Source>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_type, title, description, cover_image, wikia_url,
                    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
                    anilist_id, mal_id,
                    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
                    sport, league, country,
                    wikidata_id, scientific_name, conservation_status, taxonomic_class,
                    added_at, created_at, updated_at
             FROM sources
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_source(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, source: &Source) -> Result<Source, String> {
    let id = if source.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        source.id.clone()
    };

    let now = chrono_now();

    conn.execute(
        "INSERT INTO sources (
            id, source_type, title, description, cover_image, wikia_url,
            imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
            anilist_id, mal_id,
            sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
            sport, league, country,
            wikidata_id, scientific_name, conservation_status, taxonomic_class,
            added_at, created_at, updated_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13,
            ?14, ?15, ?16, ?17,
            ?18, ?19, ?20,
            ?21, ?22, ?23, ?24,
            ?25, ?26, ?27
         )",
        params![
            id,
            source.source_type.to_string(),
            source.title,
            source.description,
            source.cover_image,
            source.wikia_url,
            source.imdb_id,
            source.tmdb_id,
            source.igdb_id,
            source.igdb_slug,
            source.sgdb_id,
            source.anilist_id,
            source.mal_id,
            source.sports_type,
            source.sports_db_team_id,
            source.sports_db_league_id,
            source.sports_db_player_id,
            source.sport,
            source.league,
            source.country,
            source.wikidata_id,
            source.scientific_name,
            source.conservation_status,
            source.taxonomic_class,
            source.added_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Source {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..source.clone()
    })
}

pub fn update(conn: &Connection, source: &Source) -> Result<Source, String> {
    let now = chrono_now();

    conn.execute(
        "UPDATE sources SET
            source_type = ?2, title = ?3, description = ?4, cover_image = ?5, wikia_url = ?6,
            imdb_id = ?7, tmdb_id = ?8, igdb_id = ?9, igdb_slug = ?10, sgdb_id = ?11,
            anilist_id = ?12, mal_id = ?13,
            sports_type = ?14, sports_db_team_id = ?15, sports_db_league_id = ?16,
            sports_db_player_id = ?17, sport = ?18, league = ?19, country = ?20,
            wikidata_id = ?21, scientific_name = ?22, conservation_status = ?23,
            taxonomic_class = ?24,
            added_at = ?25, updated_at = ?26
         WHERE id = ?1",
        params![
            source.id,
            source.source_type.to_string(),
            source.title,
            source.description,
            source.cover_image,
            source.wikia_url,
            source.imdb_id,
            source.tmdb_id,
            source.igdb_id,
            source.igdb_slug,
            source.sgdb_id,
            source.anilist_id,
            source.mal_id,
            source.sports_type,
            source.sports_db_team_id,
            source.sports_db_league_id,
            source.sports_db_player_id,
            source.sport,
            source.league,
            source.country,
            source.wikidata_id,
            source.scientific_name,
            source.conservation_status,
            source.taxonomic_class,
            source.added_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Source {
        updated_at: now,
        ..source.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM sources WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_source(row: &rusqlite::Row) -> Source {
    let source_type_str: String = row.get(1).unwrap_or_else(|_| "movie".to_string());

    Source {
        id: row.get(0).unwrap_or_default(),
        source_type: SourceType::from_str(&source_type_str),
        title: row.get(2).unwrap_or_default(),
        description: row.get(3).unwrap_or_default(),
        cover_image: row.get(4).unwrap_or(None),
        wikia_url: row.get(5).unwrap_or(None),
        imdb_id: row.get(6).unwrap_or(None),
        tmdb_id: row.get(7).unwrap_or(None),
        igdb_id: row.get(8).unwrap_or(None),
        igdb_slug: row.get(9).unwrap_or(None),
        sgdb_id: row.get(10).unwrap_or(None),
        anilist_id: row.get(11).unwrap_or(None),
        mal_id: row.get(12).unwrap_or(None),
        sports_type: row.get(13).unwrap_or(None),
        sports_db_team_id: row.get(14).unwrap_or(None),
        sports_db_league_id: row.get(15).unwrap_or(None),
        sports_db_player_id: row.get(16).unwrap_or(None),
        sport: row.get(17).unwrap_or(None),
        league: row.get(18).unwrap_or(None),
        country: row.get(19).unwrap_or(None),
        wikidata_id: row.get(20).unwrap_or(None),
        scientific_name: row.get(21).unwrap_or(None),
        conservation_status: row.get(22).unwrap_or(None),
        taxonomic_class: row.get(23).unwrap_or(None),
        added_at: row.get(24).unwrap_or(None),
        created_at: row.get(25).unwrap_or_default(),
        updated_at: row.get(26).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
