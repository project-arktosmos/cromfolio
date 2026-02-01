use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

/// Database wrapper with mutex-protected connection
/// Uses Arc<Mutex<Connection>> so the connection can be cloned for async commands
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Initialize the database connection
    ///
    /// Opens app.db from the project root. This is the single source of truth -
    /// all /admin changes are written here and committed to git.
    pub fn init(_app_handle: &AppHandle) -> Result<Self, String> {
        let db_path = Self::find_database_path()?;

        log::info!("Using database at {:?}", db_path);

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        // Enable foreign key support
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

        // Run migrations
        Self::run_migrations(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Run database migrations
    fn run_migrations(conn: &Connection) -> Result<(), String> {
        // Create sources table if not exists (formerly albums)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL DEFAULT 'movie',
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                cover_image TEXT,
                wikia_url TEXT,
                -- Movie/TV
                imdb_id TEXT,
                tmdb_id INTEGER,
                -- Videogame
                igdb_id INTEGER,
                igdb_slug TEXT,
                sgdb_id INTEGER,
                -- Anime
                anilist_id INTEGER,
                mal_id INTEGER,
                -- Sports
                sports_type TEXT,
                sports_db_team_id TEXT,
                sports_db_league_id TEXT,
                sports_db_player_id TEXT,
                sport TEXT,
                league TEXT,
                country TEXT,
                -- Animal
                wikidata_id TEXT,
                scientific_name TEXT,
                conservation_status TEXT,
                taxonomic_class TEXT,
                -- Music
                musicbrainz_artist_id TEXT,
                musicbrainz_release_id TEXT,
                artist_name TEXT,
                music_type TEXT,
                music_genres TEXT,
                release_year INTEGER,
                record_label TEXT,
                -- Book
                open_library_author_id TEXT,
                open_library_work_id TEXT,
                author_name TEXT,
                book_type TEXT,
                book_subjects TEXT,
                first_publish_year INTEGER,
                publisher TEXT,
                -- Timestamps
                added_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create sources table: {}", e))?;

        // Migration: Add source_type column if it doesn't exist
        Self::add_column_if_not_exists(conn, "sources", "source_type", "TEXT NOT NULL DEFAULT 'movie'")?;

        // Create stickers table if not exists (formerly blueprints/templates)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stickers (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                name TEXT NOT NULL,
                image TEXT NOT NULL,
                sticker_type_id TEXT,
                rarity_id TEXT REFERENCES rarities(id) ON DELETE SET NULL,
                image_source TEXT,
                added_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create stickers table: {}", e))?;

        // Index for stickers
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_stickers_source_id ON stickers(source_id)",
            [],
        )
        .map_err(|e| format!("Failed to create stickers index: {}", e))?;

        // Migration: Add width and height columns to stickers table if they don't exist
        Self::add_column_if_not_exists(conn, "stickers", "width", "INTEGER")?;
        Self::add_column_if_not_exists(conn, "stickers", "height", "INTEGER")?;

        // Migration: Add fragment columns to stickers table (for split winner stickers)
        Self::add_column_if_not_exists(conn, "stickers", "fragment_of", "TEXT")?;
        Self::add_column_if_not_exists(conn, "stickers", "fragment_position", "INTEGER")?;

        // Create providers table if not exists (formerly sources - tracks external API IDs)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS providers (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                provider_type TEXT NOT NULL,
                external_id TEXT NOT NULL,
                external_id_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
                UNIQUE(provider_type, external_id_type, external_id)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create providers table: {}", e))?;

        // Migration: Infer source_type from existing data (must run after providers table exists)
        Self::migrate_source_types(conn)?;

        // Create rarities table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS rarities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color_from TEXT NOT NULL DEFAULT '#808080',
                color_to TEXT NOT NULL DEFAULT '#A0A0A0',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create rarities table: {}", e))?;

        // Seed default rarities (WoW-style) if table is empty
        Self::seed_default_rarities(conn)?;

        // Create sticker_types table if not exists (formerly blueprint_types/template_types)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sticker_types (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'Generic',
                source_type TEXT,
                badge_color TEXT NOT NULL DEFAULT 'badge-ghost',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create sticker_types table: {}", e))?;

        // Seed default sticker types if table is empty
        Self::seed_default_sticker_types(conn)?;

        // Create questions table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                question_text TEXT NOT NULL,
                answer_a TEXT NOT NULL,
                answer_b TEXT NOT NULL,
                answer_c TEXT NOT NULL,
                correct_answer TEXT NOT NULL CHECK(correct_answer IN ('a', 'b', 'c')),
                difficulty TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create questions table: {}", e))?;

        // Tags tables
        Self::create_tags_tables(conn)?;

        // Collection types table (must be created before collections for FK)
        Self::create_collection_types_table(conn)?;

        // Collections tables
        Self::create_collections_tables(conn)?;

        // User data tables (prefixed with _user for separation)
        Self::create_user_tables(conn)?;

        // LLM configs table
        Self::create_llm_configs_table(conn)?;

        // Stamp packs and stamps tables (service-agnostic imported stickers)
        Self::create_stamp_tables(conn)?;

        Ok(())
    }

    /// Find the database file
    ///
    /// Looks for app.db in the current directory or parent directories
    fn find_database_path() -> Result<PathBuf, String> {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;

        // Check current directory
        let db_in_cwd = cwd.join("app.db");
        if db_in_cwd.exists() {
            return Ok(db_in_cwd);
        }

        // Check parent directory (for when running from src-tauri)
        if let Some(parent) = cwd.parent() {
            let db_in_parent = parent.join("app.db");
            if db_in_parent.exists() {
                return Ok(db_in_parent);
            }
        }

        Err(format!(
            "Database not found at {:?}. Ensure app.db exists in the project root.",
            db_in_cwd
        ))
    }

    /// Add a column to a table if it doesn't exist
    fn add_column_if_not_exists(
        conn: &Connection,
        table: &str,
        column: &str,
        column_def: &str,
    ) -> Result<(), String> {
        // Check if column exists
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({})", table))
            .map_err(|e| e.to_string())?;

        let column_exists = stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                Ok(name)
            })
            .map_err(|e| e.to_string())?
            .any(|r| r.map(|n| n == column).unwrap_or(false));

        if !column_exists {
            log::info!("Adding column {} to table {}", column, table);
            conn.execute(
                &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, column_def),
                [],
            )
            .map_err(|e| format!("Failed to add column {} to {}: {}", column, table, e))?;
        }

        Ok(())
    }

    /// Rename a column if it exists (for migrations)
    /// Only renames if old column exists AND new column does NOT exist
    fn rename_column_if_exists(
        conn: &Connection,
        table: &str,
        old_column: &str,
        new_column: &str,
    ) -> Result<(), String> {
        // Get all column names
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({})", table))
            .map_err(|e| e.to_string())?;

        let columns: Vec<String> = stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                Ok(name)
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let old_column_exists = columns.iter().any(|n| n == old_column);
        let new_column_exists = columns.iter().any(|n| n == new_column);

        // Only rename if old exists and new doesn't
        if old_column_exists && !new_column_exists {
            log::info!("Renaming column {} to {} in table {}", old_column, new_column, table);
            conn.execute(
                &format!("ALTER TABLE {} RENAME COLUMN {} TO {}", table, old_column, new_column),
                [],
            )
            .map_err(|e| format!("Failed to rename column {} to {} in {}: {}", old_column, new_column, table, e))?;
        } else if old_column_exists && new_column_exists {
            log::info!("Skipping rename: both {} and {} exist in table {} (migration already applied or conflict)", old_column, new_column, table);
        }

        Ok(())
    }

    /// Migrate existing sources to infer source_type from their metadata
    fn migrate_source_types(conn: &Connection) -> Result<(), String> {
        // Update sources that have anime IDs to 'anime'
        conn.execute(
            "UPDATE sources SET source_type = 'anime'
             WHERE source_type = 'movie' AND (anilist_id IS NOT NULL OR mal_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate anime sources: {}", e))?;

        // Update sources that have videogame IDs to 'videogame'
        conn.execute(
            "UPDATE sources SET source_type = 'videogame'
             WHERE source_type = 'movie' AND (igdb_id IS NOT NULL OR sgdb_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate videogame sources: {}", e))?;

        // Update sources that have sports IDs to 'sports_league'
        conn.execute(
            "UPDATE sources SET source_type = 'sports_league'
             WHERE source_type = 'movie' AND (sports_db_team_id IS NOT NULL OR sports_db_league_id IS NOT NULL OR sports_db_player_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate sports sources: {}", e))?;

        // Update sources that have animal/wikidata IDs to 'animal'
        conn.execute(
            "UPDATE sources SET source_type = 'animal'
             WHERE source_type = 'movie' AND (wikidata_id IS NOT NULL AND scientific_name IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate animal sources: {}", e))?;

        // For remaining movie/tv - check providers table if possible
        // TV shows typically come from OMDB with type='series', but we need to check the provider_type
        conn.execute(
            "UPDATE sources SET source_type = 'tv'
             WHERE source_type = 'movie'
             AND id IN (SELECT source_id FROM providers WHERE provider_type = 'tv')",
            [],
        )
        .map_err(|e| format!("Failed to migrate TV sources: {}", e))?;

        Ok(())
    }

    /// Seed default rarities based on WoW item quality system
    fn seed_default_rarities(conn: &Connection) -> Result<(), String> {
        // Check if rarities table is empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM rarities", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count > 0 {
            return Ok(()); // Already seeded
        }

        let now = chrono::Utc::now().to_rfc3339();

        // WoW-style rarities using Tailwind color palette (500 → 700 gradients)
        let rarities = [
            // Poor (gray-400 → gray-600)
            ("poor", "Poor", "#9CA3AF", "#4B5563", 0),
            // Common (gray-200 → gray-400)
            ("common", "Common", "#E5E7EB", "#9CA3AF", 1),
            // Uncommon (green-500 → green-700)
            ("uncommon", "Uncommon", "#22C55E", "#15803D", 2),
            // Rare (blue-500 → blue-700)
            ("rare", "Rare", "#3B82F6", "#1D4ED8", 3),
            // Epic (purple-500 → purple-700)
            ("epic", "Epic", "#A855F7", "#7E22CE", 4),
            // Legendary (orange-500 → orange-700)
            ("legendary", "Legendary", "#F97316", "#C2410C", 5),
        ];

        for (id, name, color_from, color_to, sort_order) in rarities {
            conn.execute(
                "INSERT INTO rarities (id, name, color_from, color_to, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, name, color_from, color_to, sort_order, now, now],
            )
            .map_err(|e| format!("Failed to seed rarity '{}': {}", name, e))?;
        }

        log::info!("Seeded {} default rarities (WoW-style)", rarities.len());
        Ok(())
    }

    /// Create collection_types table for categorizing collections
    fn create_collection_types_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS collection_types (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                icon TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create collection_types table: {}", e))?;

        // Index for efficient sorting
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_collection_types_sort_order ON collection_types(sort_order)",
            [],
        )
        .map_err(|e| format!("Failed to create collection_types sort_order index: {}", e))?;

        // Seed default collection types
        Self::seed_default_collection_types(conn)?;

        log::info!("Collection types table created successfully");
        Ok(())
    }

    /// Seed default collection types (anime, awards, etc.)
    fn seed_default_collection_types(conn: &Connection) -> Result<(), String> {
        // Check if collection_types table is empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM collection_types", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count > 0 {
            return Ok(()); // Already seeded
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Default collection types - (id, name, description, icon, sort_order)
        let collection_types = [
            ("anime", "Anime", "Collections featuring anime series and movies", "🎌", 0),
            ("awards", "Awards", "Collections featuring award shows and ceremonies", "🏆", 1),
        ];

        for (id, name, description, icon, sort_order) in collection_types {
            conn.execute(
                "INSERT INTO collection_types (id, name, description, icon, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![id, name, description, icon, sort_order, now, now],
            )
            .map_err(|e| format!("Failed to seed collection type '{}': {}", name, e))?;
        }

        log::info!("Seeded {} default collection types", collection_types.len());
        Ok(())
    }

    /// Create tags and sticker_tags tables for many-to-many tagging
    fn create_tags_tables(conn: &Connection) -> Result<(), String> {
        // Tags table - stores tag definitions (key-value pairs)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(key, value)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create tags table: {}", e))?;

        // Junction table for many-to-many sticker-tag relationships
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sticker_tags (
                sticker_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (sticker_id, tag_id),
                FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create sticker_tags table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tags_key ON tags(key)",
            [],
        )
        .map_err(|e| format!("Failed to create tags key index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sticker_tags_sticker_id ON sticker_tags(sticker_id)",
            [],
        )
        .map_err(|e| format!("Failed to create sticker_tags sticker_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sticker_tags_tag_id ON sticker_tags(tag_id)",
            [],
        )
        .map_err(|e| format!("Failed to create sticker_tags tag_id index: {}", e))?;

        log::info!("Tags tables created successfully");
        Ok(())
    }

    /// Create collections and collection_stickers tables for grouping stickers
    fn create_collections_tables(conn: &Connection) -> Result<(), String> {
        // Collections table - stores collection definitions
        conn.execute(
            "CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                collection_type_id TEXT REFERENCES collection_types(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                cover_image TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create collections table: {}", e))?;

        // Migration: Add collection_type_id column if it doesn't exist
        Self::add_column_if_not_exists(conn, "collections", "collection_type_id", "TEXT REFERENCES collection_types(id) ON DELETE SET NULL")?;

        // Index for efficient lookups by collection_type_id
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_collections_collection_type_id ON collections(collection_type_id)",
            [],
        )
        .map_err(|e| format!("Failed to create collections collection_type_id index: {}", e))?;

        // Junction table for many-to-many collection-sticker relationships
        conn.execute(
            "CREATE TABLE IF NOT EXISTS collection_stickers (
                collection_id TEXT NOT NULL,
                sticker_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                added_at TEXT NOT NULL,
                PRIMARY KEY (collection_id, sticker_id),
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create collection_stickers table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_collection_stickers_collection_id ON collection_stickers(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create collection_stickers collection_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_collection_stickers_sticker_id ON collection_stickers(sticker_id)",
            [],
        )
        .map_err(|e| format!("Failed to create collection_stickers sticker_id index: {}", e))?;

        log::info!("Collections tables created successfully");
        Ok(())
    }

    /// Create _user_stickers and _user_collections tables for user game data
    /// These tables are prefixed with _user to separate user data from admin data
    fn create_user_tables(conn: &Connection) -> Result<(), String> {
        // _user_stickers table - tracks which stickers the user owns
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_stickers (
                id TEXT PRIMARY KEY,
                sticker_id TEXT NOT NULL,
                source_id TEXT NOT NULL,
                acquired_at TEXT NOT NULL,
                FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_stickers table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker_id ON _user_stickers(sticker_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_stickers sticker_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_stickers_source_id ON _user_stickers(source_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_stickers source_id index: {}", e))?;

        // _user_collections table - tracks user progress on collections
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_collections (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_collections table: {}", e))?;

        // Index for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_collections_collection_id ON _user_collections(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_collections collection_id index: {}", e))?;

        // _user_sources table - tracks which sources the user owns
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_sources (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL UNIQUE,
                acquired_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_sources table: {}", e))?;

        // Index for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_sources_source_id ON _user_sources(source_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_sources source_id index: {}", e))?;

        log::info!("User tables (_user_stickers, _user_collections, _user_sources) created successfully");
        Ok(())
    }

    /// Seed default sticker types (mirrors card types)
    fn seed_default_sticker_types(conn: &Connection) -> Result<(), String> {
        // Check if sticker_types table is empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sticker_types", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count > 0 {
            return Ok(()); // Already seeded
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Sticker types matching card types - (id, name, description, category, source_type, badge_color, sort_order)
        let sticker_types: Vec<(&str, &str, &str, &str, Option<&str>, &str, i32)> = vec![
            // Generic
            ("other", "Other", "Generic fallback type for uncategorized images", "Generic", None, "badge-ghost", 0),
            // Movie/TV - supports both movie and tv source types
            ("poster", "Poster", "Movie or TV show poster artwork", "Movie/TV", Some("movie"), "badge-primary", 1),
            ("backdrop", "Backdrop", "Wide background/banner image (TMDB)", "Movie/TV", Some("movie"), "badge-secondary", 2),
            ("background", "Background", "Background image (Fanart)", "Movie/TV", Some("movie"), "badge-secondary", 3),
            ("logo", "Logo", "Clearlogo or HD logo artwork", "Movie/TV", Some("movie"), "badge-accent", 4),
            ("hdlogo", "HD Logo", "High-definition logo artwork", "Movie/TV", Some("movie"), "badge-accent", 5),
            ("cast", "Cast", "Actor or person photo", "Movie/TV", Some("movie"), "badge-info", 6),
            ("characterart", "Character Art", "Character artwork from Fanart", "Movie/TV", Some("movie"), "badge-warning", 7),
            ("thumb", "Thumbnail", "Thumbnail/thumb artwork", "Movie/TV", Some("movie"), "badge-ghost", 8),
            ("banner", "Banner", "Wide banner image", "Movie/TV", Some("movie"), "badge-secondary", 9),
            ("disc", "Disc", "DVD/Blu-ray disc artwork", "Movie/TV", Some("movie"), "badge-ghost", 10),
            ("clearart", "Clear Art", "Transparent artwork", "Movie/TV", Some("movie"), "badge-accent", 11),
            ("art", "Art", "General artwork", "Movie/TV", Some("movie"), "badge-ghost", 12),
            ("seasonposter", "Season Poster", "TV season poster", "Movie/TV", Some("tv"), "badge-primary", 13),
            ("seasonthumb", "Season Thumbnail", "TV season thumbnail", "Movie/TV", Some("tv"), "badge-ghost", 14),
            ("seasonbanner", "Season Banner", "TV season banner", "Movie/TV", Some("tv"), "badge-secondary", 15),
            // Videogame
            ("cover", "Cover", "Game box art cover", "Videogame", Some("videogame"), "badge-primary", 20),
            ("screenshot", "Screenshot", "In-game screenshot", "Videogame", Some("videogame"), "badge-secondary", 21),
            ("artwork", "Artwork", "Official artwork or promotional art", "Videogame", Some("videogame"), "badge-accent", 22),
            ("hero", "Hero", "Wide banner/hero image (SGDB)", "Videogame", Some("videogame"), "badge-info", 23),
            ("icon", "Icon", "Small square icon", "Videogame", Some("videogame"), "badge-warning", 24),
            ("grid", "Grid", "Steam grid image format", "Videogame", Some("videogame"), "badge-success", 25),
            ("grid-alt", "Grid Alt", "Alternate Steam grid format", "Videogame", Some("videogame"), "badge-success", 26),
            // Anime
            ("character", "Character", "Anime/manga character", "Anime", Some("anime"), "badge-info", 30),
            ("main_character", "Main Character", "Main protagonist character", "Anime", Some("anime"), "badge-primary", 31),
            ("picture", "Picture", "Anime picture (Jikan)", "Anime", Some("anime"), "badge-ghost", 32),
            // Sports
            ("player", "Player", "Sports player photo", "Sports", Some("sports_league"), "badge-success", 40),
            ("team_badge", "Team Badge", "Team logo or crest", "Sports", Some("sports_league"), "badge-warning", 41),
            ("badge", "Badge", "Team or league badge", "Sports", Some("sports_league"), "badge-warning", 42),
            ("jersey", "Jersey", "Team jersey image", "Sports", Some("sports_league"), "badge-info", 43),
            ("stadium", "Stadium", "Stadium photo", "Sports", Some("sports_league"), "badge-secondary", 44),
            ("trophy", "Trophy", "Trophy image", "Sports", Some("sports_league"), "badge-accent", 45),
            ("fanart", "Fanart", "Fan artwork", "Sports", Some("sports_league"), "badge-ghost", 46),
            // Animal
            ("photo", "Photo", "Wildlife or nature photo", "Animal", Some("animal"), "badge-success", 50),
            ("species", "Species", "Species image", "Animal", Some("animal"), "badge-primary", 51),
            ("observation", "Observation", "iNaturalist observation", "Animal", Some("animal"), "badge-info", 52),
            ("default", "Default", "Default image", "Animal", Some("animal"), "badge-ghost", 53),
        ];

        let sticker_types_count = sticker_types.len();
        for (id, name, description, category, source_type, badge_color, sort_order) in sticker_types {
            conn.execute(
                "INSERT INTO sticker_types (id, name, description, category, source_type, badge_color, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![id, name, description, category, source_type, badge_color, sort_order, now, now],
            )
            .map_err(|e| format!("Failed to seed sticker type '{}': {}", name, e))?;
        }

        log::info!("Seeded {} default sticker types", sticker_types_count);
        Ok(())
    }

    /// Create llm_configs table for storing LLM server configurations
    fn create_llm_configs_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS llm_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                provider TEXT NOT NULL CHECK(provider IN ('lmstudio', 'ollama')),
                base_url TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create llm_configs table: {}", e))?;

        log::info!("LLM configs table created successfully");
        Ok(())
    }

    /// Create stamp_packs and stamps tables for imported stickers (WhatsApp, Telegram, etc.)
    /// These are service-agnostic tables that store imported sticker packs from various sources
    fn create_stamp_tables(conn: &Connection) -> Result<(), String> {
        // stamp_packs table - stores imported sticker pack metadata
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stamp_packs (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                name TEXT NOT NULL,
                author TEXT NOT NULL DEFAULT '',
                tray_image TEXT,
                pack_file TEXT,
                sticker_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create stamp_packs table: {}", e))?;

        // Migration: Add columns if they don't exist (for older databases)
        Self::add_column_if_not_exists(conn, "stamp_packs", "source", "TEXT NOT NULL DEFAULT 'unknown'")?;
        Self::add_column_if_not_exists(conn, "stamp_packs", "author", "TEXT NOT NULL DEFAULT ''")?;
        Self::add_column_if_not_exists(conn, "stamp_packs", "tray_image", "TEXT")?;
        Self::add_column_if_not_exists(conn, "stamp_packs", "pack_file", "TEXT")?;
        Self::add_column_if_not_exists(conn, "stamp_packs", "sticker_count", "INTEGER NOT NULL DEFAULT 0")?;

        // Index for efficient lookups by source
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_stamp_packs_source ON stamp_packs(source)",
            [],
        )
        .map_err(|e| format!("Failed to create stamp_packs source index: {}", e))?;

        // stamps table - individual stickers within a pack
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stamps (
                id TEXT PRIMARY KEY,
                pack_id TEXT NOT NULL,
                image_path TEXT NOT NULL,
                emojis TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (pack_id) REFERENCES stamp_packs(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create stamps table: {}", e))?;

        // Migration: Rename stamp_pack_id to pack_id if old column exists
        Self::rename_column_if_exists(conn, "stamps", "stamp_pack_id", "pack_id")?;

        // Migration: Add columns to stamps table if they don't exist (for older databases)
        Self::add_column_if_not_exists(conn, "stamps", "pack_id", "TEXT")?;
        Self::add_column_if_not_exists(conn, "stamps", "image_path", "TEXT NOT NULL DEFAULT ''")?;
        Self::add_column_if_not_exists(conn, "stamps", "emojis", "TEXT")?;
        Self::add_column_if_not_exists(conn, "stamps", "created_at", "TEXT NOT NULL DEFAULT ''")?;

        // Index for efficient lookups by pack_id
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_stamps_pack_id ON stamps(pack_id)",
            [],
        )
        .map_err(|e| format!("Failed to create stamps pack_id index: {}", e))?;

        log::info!("Stamp tables (stamp_packs, stamps) created successfully");
        Ok(())
    }
}
