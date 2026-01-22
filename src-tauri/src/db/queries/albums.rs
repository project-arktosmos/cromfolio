use rusqlite::{params, Connection};
use crate::models::{Album, AlbumType};

pub fn get_all(conn: &Connection) -> Result<Vec<Album>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_type, title, description, cover_image, wikia_url,
                    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
                    anilist_id, mal_id,
                    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
                    sport, league, country,
                    wikidata_id, scientific_name, conservation_status, taxonomic_class,
                    musicbrainz_artist_id, musicbrainz_release_id, artist_name, music_type,
                    music_genres, release_year, record_label,
                    open_library_author_id, open_library_work_id, author_name, book_type,
                    book_subjects, first_publish_year, publisher,
                    added_at, created_at, updated_at
             FROM albums
             ORDER BY title ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(row_to_album(row)))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Album>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, album_type, title, description, cover_image, wikia_url,
                    imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
                    anilist_id, mal_id,
                    sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
                    sport, league, country,
                    wikidata_id, scientific_name, conservation_status, taxonomic_class,
                    musicbrainz_artist_id, musicbrainz_release_id, artist_name, music_type,
                    music_genres, release_year, record_label,
                    open_library_author_id, open_library_work_id, author_name, book_type,
                    book_subjects, first_publish_year, publisher,
                    added_at, created_at, updated_at
             FROM albums
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| Ok(row_to_album(row)))
        .map_err(|e| e.to_string())?;

    match rows.next() {
        Some(result) => Ok(Some(result.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn create(conn: &Connection, album: &Album) -> Result<Album, String> {
    let id = if album.id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        album.id.clone()
    };

    let now = chrono_now();
    let music_genres_json = album.music_genres.as_ref()
        .and_then(|v| serde_json::to_string(v).ok());
    let book_subjects_json = album.book_subjects.as_ref()
        .and_then(|v| serde_json::to_string(v).ok());

    conn.execute(
        "INSERT INTO albums (
            id, album_type, title, description, cover_image, wikia_url,
            imdb_id, tmdb_id, igdb_id, igdb_slug, sgdb_id,
            anilist_id, mal_id,
            sports_type, sports_db_team_id, sports_db_league_id, sports_db_player_id,
            sport, league, country,
            wikidata_id, scientific_name, conservation_status, taxonomic_class,
            musicbrainz_artist_id, musicbrainz_release_id, artist_name, music_type,
            music_genres, release_year, record_label,
            open_library_author_id, open_library_work_id, author_name, book_type,
            book_subjects, first_publish_year, publisher,
            added_at, created_at, updated_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13,
            ?14, ?15, ?16, ?17,
            ?18, ?19, ?20,
            ?21, ?22, ?23, ?24,
            ?25, ?26, ?27, ?28,
            ?29, ?30, ?31,
            ?32, ?33, ?34, ?35,
            ?36, ?37, ?38,
            ?39, ?40, ?41
         )",
        params![
            id,
            album.album_type.to_string(),
            album.title,
            album.description,
            album.cover_image,
            album.wikia_url,
            album.imdb_id,
            album.tmdb_id,
            album.igdb_id,
            album.igdb_slug,
            album.sgdb_id,
            album.anilist_id,
            album.mal_id,
            album.sports_type,
            album.sports_db_team_id,
            album.sports_db_league_id,
            album.sports_db_player_id,
            album.sport,
            album.league,
            album.country,
            album.wikidata_id,
            album.scientific_name,
            album.conservation_status,
            album.taxonomic_class,
            album.musicbrainz_artist_id,
            album.musicbrainz_release_id,
            album.artist_name,
            album.music_type,
            music_genres_json,
            album.release_year,
            album.record_label,
            album.open_library_author_id,
            album.open_library_work_id,
            album.author_name,
            album.book_type,
            book_subjects_json,
            album.first_publish_year,
            album.publisher,
            album.added_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Album {
        id,
        created_at: now.clone(),
        updated_at: now,
        ..album.clone()
    })
}

pub fn update(conn: &Connection, album: &Album) -> Result<Album, String> {
    let now = chrono_now();
    let music_genres_json = album.music_genres.as_ref()
        .and_then(|v| serde_json::to_string(v).ok());
    let book_subjects_json = album.book_subjects.as_ref()
        .and_then(|v| serde_json::to_string(v).ok());

    conn.execute(
        "UPDATE albums SET
            album_type = ?2, title = ?3, description = ?4, cover_image = ?5, wikia_url = ?6,
            imdb_id = ?7, tmdb_id = ?8, igdb_id = ?9, igdb_slug = ?10, sgdb_id = ?11,
            anilist_id = ?12, mal_id = ?13,
            sports_type = ?14, sports_db_team_id = ?15, sports_db_league_id = ?16,
            sports_db_player_id = ?17, sport = ?18, league = ?19, country = ?20,
            wikidata_id = ?21, scientific_name = ?22, conservation_status = ?23,
            taxonomic_class = ?24,
            musicbrainz_artist_id = ?25, musicbrainz_release_id = ?26, artist_name = ?27,
            music_type = ?28, music_genres = ?29, release_year = ?30, record_label = ?31,
            open_library_author_id = ?32, open_library_work_id = ?33, author_name = ?34,
            book_type = ?35, book_subjects = ?36, first_publish_year = ?37, publisher = ?38,
            added_at = ?39, updated_at = ?40
         WHERE id = ?1",
        params![
            album.id,
            album.album_type.to_string(),
            album.title,
            album.description,
            album.cover_image,
            album.wikia_url,
            album.imdb_id,
            album.tmdb_id,
            album.igdb_id,
            album.igdb_slug,
            album.sgdb_id,
            album.anilist_id,
            album.mal_id,
            album.sports_type,
            album.sports_db_team_id,
            album.sports_db_league_id,
            album.sports_db_player_id,
            album.sport,
            album.league,
            album.country,
            album.wikidata_id,
            album.scientific_name,
            album.conservation_status,
            album.taxonomic_class,
            album.musicbrainz_artist_id,
            album.musicbrainz_release_id,
            album.artist_name,
            album.music_type,
            music_genres_json,
            album.release_year,
            album.record_label,
            album.open_library_author_id,
            album.open_library_work_id,
            album.author_name,
            album.book_type,
            book_subjects_json,
            album.first_publish_year,
            album.publisher,
            album.added_at,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Album {
        updated_at: now,
        ..album.clone()
    })
}

pub fn delete(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM albums WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows_affected > 0)
}

fn row_to_album(row: &rusqlite::Row) -> Album {
    let album_type_str: String = row.get(1).unwrap_or_else(|_| "movie".to_string());

    let music_genres_json: Option<String> = row.get(28).unwrap_or(None);
    let music_genres = music_genres_json
        .and_then(|s| serde_json::from_str(&s).ok());

    let book_subjects_json: Option<String> = row.get(35).unwrap_or(None);
    let book_subjects = book_subjects_json
        .and_then(|s| serde_json::from_str(&s).ok());

    Album {
        id: row.get(0).unwrap_or_default(),
        album_type: AlbumType::from_str(&album_type_str),
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
        musicbrainz_artist_id: row.get(24).unwrap_or(None),
        musicbrainz_release_id: row.get(25).unwrap_or(None),
        artist_name: row.get(26).unwrap_or(None),
        music_type: row.get(27).unwrap_or(None),
        music_genres,
        release_year: row.get(29).unwrap_or(None),
        record_label: row.get(30).unwrap_or(None),
        open_library_author_id: row.get(31).unwrap_or(None),
        open_library_work_id: row.get(32).unwrap_or(None),
        author_name: row.get(33).unwrap_or(None),
        book_type: row.get(34).unwrap_or(None),
        book_subjects,
        first_publish_year: row.get(36).unwrap_or(None),
        publisher: row.get(37).unwrap_or(None),
        added_at: row.get(38).unwrap_or(None),
        created_at: row.get(39).unwrap_or_default(),
        updated_at: row.get(40).unwrap_or_default(),
    }
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
