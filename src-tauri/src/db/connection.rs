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
        // Note: rarity is stored on user_stickers (owned stickers), not on sticker templates
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stickers (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                name TEXT NOT NULL,
                image TEXT NOT NULL,
                sticker_type_id TEXT,
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

        // Migration: Remove "poor" rarity and fix sort orders
        Self::migrate_rarities_remove_poor(conn)?;

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
        // New schema: correct_answer is the actual answer text, wrong_answers is a JSON array
        conn.execute(
            "CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                question_text TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                wrong_answers TEXT NOT NULL DEFAULT '[]',
                difficulty TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create questions table: {}", e))?;

        // Migration: Convert old questions schema to new schema
        Self::migrate_questions_schema(conn)?;

        // Tags tables
        Self::create_tags_tables(conn)?;

        // Collection types table (must be created before collections for FK)
        Self::create_collection_types_table(conn)?;

        // Collections tables
        Self::create_collections_tables(conn)?;

        // User data tables (prefixed with _user for separation)
        Self::create_user_tables(conn)?;

        // Migration: Add rarity_id column to _user_stickers table
        Self::add_column_if_not_exists(conn, "_user_stickers", "rarity_id", "TEXT REFERENCES rarities(id) ON DELETE SET NULL")?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_stickers_rarity_id ON _user_stickers(rarity_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_stickers rarity_id index: {}", e))?;

        // LLM configs table
        Self::create_llm_configs_table(conn)?;

        // Stamp packs and stamps tables (service-agnostic imported stickers)
        Self::create_stamp_tables(conn)?;

        // Pokemon trivia templates table
        Self::create_pokemon_trivia_templates_table(conn)?;

        // Pokemon trivia templates v2 table (enhanced)
        Self::create_pokemon_trivia_templates_v2_table(conn)?;

        Ok(())
    }

    /// Find the database file
    ///
    /// Always uses app.db from the project root (not src-tauri/).
    /// This is the single source of truth for all database operations.
    fn find_database_path() -> Result<PathBuf, String> {
        let cwd = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;

        // ALWAYS check parent directory first (for when running from src-tauri)
        // This ensures we use ./app.db from project root, not src-tauri/app.db
        if let Some(parent) = cwd.parent() {
            let db_in_parent = parent.join("app.db");
            if db_in_parent.exists() {
                return Ok(db_in_parent);
            }
        }

        // Fallback to current directory (when running from project root)
        let db_in_cwd = cwd.join("app.db");
        if db_in_cwd.exists() {
            return Ok(db_in_cwd);
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

    /// Populate region field for Pokemon collections based on generation in title
    fn populate_pokemon_regions(conn: &Connection) -> Result<(), String> {
        // Map Pokemon generations to their regions
        let generation_regions = [
            ("Generation 1", "Kanto"),
            ("Generation 2", "Johto"),
            ("Generation 3", "Hoenn"),
            ("Generation 4", "Sinnoh"),
            ("Generation 5", "Unova"),
            ("Generation 6", "Kalos"),
            ("Generation 7", "Alola"),
            ("Generation 8", "Galar"),
            ("Generation 9", "Paldea"),
            ("Gen 1", "Kanto"),
            ("Gen 2", "Johto"),
            ("Gen 3", "Hoenn"),
            ("Gen 4", "Sinnoh"),
            ("Gen 5", "Unova"),
            ("Gen 6", "Kalos"),
            ("Gen 7", "Alola"),
            ("Gen 8", "Galar"),
            ("Gen 9", "Paldea"),
        ];

        for (gen_pattern, region) in generation_regions {
            conn.execute(
                "UPDATE collections SET region = ?1 WHERE title LIKE ?2 AND region IS NULL",
                rusqlite::params![region, format!("%{}%", gen_pattern)],
            )
            .map_err(|e| format!("Failed to populate region for {}: {}", gen_pattern, e))?;
        }

        // Special case: "All Pokemon" gets "Master"
        conn.execute(
            "UPDATE collections SET region = 'Master' WHERE title LIKE '%All Pokemon%' AND (region IS NULL OR region = 'Master Collection')",
            [],
        )
        .map_err(|e| format!("Failed to set Master region: {}", e))?;

        log::info!("Pokemon regions migration completed");
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

    /// Migrate questions table from old schema (answer_a, answer_b, answer_c, correct_answer as 'a'|'b'|'c')
    /// to new schema (correct_answer as actual text, wrong_answers as JSON array)
    fn migrate_questions_schema(conn: &Connection) -> Result<(), String> {
        // Check if old columns exist (answer_a is the indicator)
        let mut stmt = conn
            .prepare("PRAGMA table_info(questions)")
            .map_err(|e| e.to_string())?;

        let columns: Vec<String> = stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                Ok(name)
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let has_old_schema = columns.iter().any(|n| n == "answer_a");
        let has_new_schema = columns.iter().any(|n| n == "wrong_answers");

        // If we have old schema but no new schema, we need to migrate
        if has_old_schema && !has_new_schema {
            log::info!("Migrating questions table to new schema...");

            // Add the new wrong_answers column
            conn.execute(
                "ALTER TABLE questions ADD COLUMN wrong_answers TEXT NOT NULL DEFAULT '[]'",
                [],
            )
            .map_err(|e| format!("Failed to add wrong_answers column: {}", e))?;

            // Migrate existing data: convert old format to new format
            // The old correct_answer is 'a', 'b', or 'c' - we need to get the actual answer text
            // and put the other two answers into wrong_answers
            conn.execute(
                "UPDATE questions SET
                    wrong_answers = json_array(
                        CASE WHEN correct_answer = 'a' THEN answer_b ELSE answer_a END,
                        CASE WHEN correct_answer = 'c' THEN answer_b ELSE answer_c END
                    ),
                    correct_answer = CASE correct_answer
                        WHEN 'a' THEN answer_a
                        WHEN 'b' THEN answer_b
                        WHEN 'c' THEN answer_c
                        ELSE correct_answer
                    END
                WHERE correct_answer IN ('a', 'b', 'c')",
                [],
            )
            .map_err(|e| format!("Failed to migrate question data: {}", e))?;

            log::info!("Questions table migrated to new schema successfully");
        }

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
            // Common (gray-400 → gray-600) - lowest quality
            ("common", "Common", "#9CA3AF", "#4B5563", 0),
            // Uncommon (green-500 → green-700)
            ("uncommon", "Uncommon", "#22C55E", "#15803D", 1),
            // Rare (blue-500 → blue-700)
            ("rare", "Rare", "#3B82F6", "#1D4ED8", 2),
            // Epic (purple-500 → purple-700)
            ("epic", "Epic", "#A855F7", "#7E22CE", 3),
            // Legendary (orange-500 → orange-700)
            ("legendary", "Legendary", "#F97316", "#C2410C", 4),
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

    /// Migration: Remove "poor" rarity and update sort orders
    /// Common becomes the lowest quality (sort_order 0)
    fn migrate_rarities_remove_poor(conn: &Connection) -> Result<(), String> {
        // Check if "poor" rarity exists
        let poor_exists: bool = conn
            .query_row(
                "SELECT 1 FROM rarities WHERE id = 'poor'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !poor_exists {
            return Ok(()); // Already migrated
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Update any user_stickers that reference "poor" to use "common" instead
        conn.execute(
            "UPDATE _user_stickers SET rarity_id = 'common' WHERE rarity_id = 'poor'",
            [],
        )
        .map_err(|e| format!("Failed to migrate user_stickers from poor to common: {}", e))?;

        // Delete "poor" rarity
        conn.execute("DELETE FROM rarities WHERE id = 'poor'", [])
            .map_err(|e| format!("Failed to delete poor rarity: {}", e))?;

        // Update common to have gray colors and sort_order 0
        conn.execute(
            "UPDATE rarities SET color_from = '#9CA3AF', color_to = '#4B5563', sort_order = 0, updated_at = ?1 WHERE id = 'common'",
            rusqlite::params![now],
        )
        .map_err(|e| format!("Failed to update common rarity: {}", e))?;

        // Shift all other sort_orders down by 1
        conn.execute(
            "UPDATE rarities SET sort_order = sort_order - 1, updated_at = ?1 WHERE id IN ('uncommon', 'rare', 'epic', 'legendary')",
            rusqlite::params![now],
        )
        .map_err(|e| format!("Failed to update rarity sort orders: {}", e))?;

        log::info!("Migrated rarities: removed 'poor', 'common' is now the lowest quality");
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
            ("pokemon", "Pokemon", "Collections featuring Pokemon from various generations", "⚡", 2),
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

        // Migration: Add region column if it doesn't exist
        Self::add_column_if_not_exists(conn, "collections", "region", "TEXT")?;

        // Migration: Populate region based on Pokemon generation in title
        Self::populate_pokemon_regions(conn)?;

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

        // _user_placed_stamps table - tracks stamps placed on album pages
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_placed_stamps (
                id TEXT PRIMARY KEY,
                stamp_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                page_index INTEGER NOT NULL,
                position_x REAL NOT NULL,
                position_y REAL NOT NULL,
                scale REAL NOT NULL DEFAULT 1.0,
                rotation REAL NOT NULL DEFAULT 0,
                placed_at TEXT NOT NULL,
                FOREIGN KEY (stamp_id) REFERENCES stamps(id) ON DELETE CASCADE,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_stamps table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_placed_stamps_collection_id ON _user_placed_stamps(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_stamps collection_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_placed_stamps_stamp_id ON _user_placed_stamps(stamp_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_stamps stamp_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_placed_stamps_collection_page ON _user_placed_stamps(collection_id, page_index)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_stamps collection_page index: {}", e))?;

        // _user_sticker_placements table - tracks which stickers are "stuck" in albums
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_sticker_placements (
                id TEXT PRIMARY KEY,
                sticker_id TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                placed_at TEXT NOT NULL,
                FOREIGN KEY (sticker_id) REFERENCES stickers(id) ON DELETE CASCADE,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                UNIQUE(sticker_id, collection_id)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_sticker_placements table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_sticker_placements_sticker_id ON _user_sticker_placements(sticker_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_sticker_placements sticker_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_sticker_placements_collection_id ON _user_sticker_placements(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_sticker_placements collection_id index: {}", e))?;

        // _user_placed_icons table - tracks SVG icons placed on album pages
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_placed_icons (
                id TEXT PRIMARY KEY,
                icon_path TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                page_index INTEGER NOT NULL,
                position_x REAL NOT NULL,
                position_y REAL NOT NULL,
                scale REAL NOT NULL DEFAULT 1.0,
                rotation REAL NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT '#000000',
                placed_at TEXT NOT NULL,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_icons table: {}", e))?;

        // Indexes for _user_placed_icons
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_placed_icons_collection_id ON _user_placed_icons(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_icons collection_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_placed_icons_collection_page ON _user_placed_icons(collection_id, page_index)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_placed_icons collection_page index: {}", e))?;

        // _user_player table - singleton table for player profile
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_player (
                id TEXT PRIMARY KEY DEFAULT 'player',
                name TEXT NOT NULL DEFAULT 'Adventurer',
                experience INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                last_played_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_player table: {}", e))?;

        // _user_game_stats table - stores game statistics by game type
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_game_stats (
                id TEXT PRIMARY KEY,
                game_type TEXT NOT NULL UNIQUE,
                total_games_played INTEGER NOT NULL DEFAULT 0,
                total_score INTEGER NOT NULL DEFAULT 0,
                best_score INTEGER NOT NULL DEFAULT 0,
                total_correct INTEGER NOT NULL DEFAULT 0,
                total_wrong INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                longest_game INTEGER NOT NULL DEFAULT 0,
                last_played_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_game_stats table: {}", e))?;

        // Index for _user_game_stats by game_type
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_game_stats_game_type ON _user_game_stats(game_type)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_game_stats game_type index: {}", e))?;

        // _user_booster_packs table - stores earned booster packs
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _user_booster_packs (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                earned_from TEXT NOT NULL,
                earned_at TEXT NOT NULL,
                opened_at TEXT,
                FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create _user_booster_packs table: {}", e))?;

        // Indexes for _user_booster_packs
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_booster_packs_collection_id ON _user_booster_packs(collection_id)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_booster_packs collection_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_booster_packs_opened_at ON _user_booster_packs(opened_at)",
            [],
        )
        .map_err(|e| format!("Failed to create _user_booster_packs opened_at index: {}", e))?;

        log::info!("User tables (_user_stickers, _user_collections, _user_sources, _user_placed_stamps, _user_sticker_placements, _user_placed_icons, _user_player, _user_game_stats, _user_booster_packs) created successfully");
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

    /// Create pokemon_trivia_templates table for storing trivia question templates
    fn create_pokemon_trivia_templates_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pokemon_trivia_templates (
                id TEXT PRIMARY KEY,
                tag_key TEXT NOT NULL,
                question_template TEXT NOT NULL,
                answer_template TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates table: {}", e))?;

        // Index for efficient lookups by tag_key
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pokemon_trivia_templates_tag_key ON pokemon_trivia_templates(tag_key)",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates tag_key index: {}", e))?;

        log::info!("Pokemon trivia templates table created successfully");
        Ok(())
    }

    /// Create pokemon_trivia_templates_v2 table for enhanced trivia question templates
    /// Supports 9 different template types: simple_match, reverse_lookup, superlative,
    /// comparison, multi_condition, range, negation, statistical, type_effectiveness
    fn create_pokemon_trivia_templates_v2_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pokemon_trivia_templates_v2 (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                template_type TEXT NOT NULL,
                question_template TEXT NOT NULL,
                answer_template TEXT NOT NULL,
                primary_attribute TEXT NOT NULL,
                conditions TEXT NOT NULL DEFAULT '[]',
                condition_logic TEXT NOT NULL DEFAULT 'and',
                scope_filters TEXT NOT NULL DEFAULT '{}',
                comparison_config TEXT,
                difficulty TEXT,
                weight INTEGER NOT NULL DEFAULT 100,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates_v2 table: {}", e))?;

        // Indexes for efficient lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ptt_v2_template_type ON pokemon_trivia_templates_v2(template_type)",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates_v2 template_type index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ptt_v2_primary_attribute ON pokemon_trivia_templates_v2(primary_attribute)",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates_v2 primary_attribute index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ptt_v2_is_active ON pokemon_trivia_templates_v2(is_active)",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates_v2 is_active index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ptt_v2_difficulty ON pokemon_trivia_templates_v2(difficulty)",
            [],
        )
        .map_err(|e| format!("Failed to create pokemon_trivia_templates_v2 difficulty index: {}", e))?;

        // Migrate existing templates from v1 to v2 if v2 is empty and v1 has data
        Self::migrate_pokemon_trivia_templates_v1_to_v2(conn)?;

        // Seed default templates if table is empty
        Self::seed_pokemon_trivia_templates_v2(conn)?;

        // Migration: Remove "Not Water Type" negation template (confusing type-based negation questions)
        Self::migrate_remove_not_water_type_template(conn)?;

        log::info!("Pokemon trivia templates v2 table created successfully");
        Ok(())
    }

    /// Migrate existing pokemon_trivia_templates to v2 format
    fn migrate_pokemon_trivia_templates_v1_to_v2(conn: &Connection) -> Result<(), String> {
        // Check if v2 table is empty
        let v2_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM pokemon_trivia_templates_v2", [], |row| row.get(0))
            .unwrap_or(0);

        if v2_count > 0 {
            return Ok(()); // Already has data, skip migration
        }

        // Check if v1 table has data
        let v1_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM pokemon_trivia_templates", [], |row| row.get(0))
            .unwrap_or(0);

        if v1_count == 0 {
            return Ok(()); // No data to migrate
        }

        log::info!("Migrating {} pokemon trivia templates from v1 to v2...", v1_count);

        // Migrate v1 templates to v2 as simple_match type
        conn.execute(
            "INSERT INTO pokemon_trivia_templates_v2 (
                id, name, description, template_type,
                question_template, answer_template, primary_attribute,
                conditions, condition_logic, scope_filters, comparison_config,
                difficulty, weight, is_active, created_at, updated_at
            )
            SELECT
                id,
                tag_key || ' template',
                '',
                'simple_match',
                question_template,
                answer_template,
                tag_key,
                '[]',
                'and',
                '{}',
                NULL,
                NULL,
                100,
                is_active,
                created_at,
                updated_at
            FROM pokemon_trivia_templates",
            [],
        )
        .map_err(|e| format!("Failed to migrate pokemon trivia templates: {}", e))?;

        log::info!("Successfully migrated {} pokemon trivia templates to v2", v1_count);
        Ok(())
    }

    /// Seed default Pokemon trivia templates v2 covering all 9 template types
    fn seed_pokemon_trivia_templates_v2(conn: &Connection) -> Result<(), String> {
        // Check if seed templates already exist by looking for a specific seed template name
        // This allows seeding even if migration added v1 templates to v2
        let seed_exists: bool = conn
            .query_row(
                "SELECT 1 FROM pokemon_trivia_templates_v2 WHERE name = 'Pokemon Type'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if seed_exists {
            return Ok(()); // Seed templates already exist
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Starter templates for each type
        // Format: (name, description, template_type, question_template, answer_template, primary_attribute, conditions, condition_logic, scope_filters, comparison_config, difficulty, weight)
        let templates: Vec<(&str, &str, &str, &str, &str, &str, &str, &str, &str, Option<&str>, Option<&str>, i32)> = vec![
            // Simple Match templates
            ("Pokemon Type", "Ask what type a Pokemon is", "simple_match", "What type is {name}?", "{type}", "type", "[]", "and", "{}", None, Some("easy"), 100),
            ("Pokemon Generation", "Ask which generation a Pokemon is from", "simple_match", "{name} is from which generation?", "{generation}", "generation", "[]", "and", "{}", None, Some("easy"), 100),
            ("Pokemon Ability", "Ask about a Pokemon's ability", "simple_match", "What is {name}'s primary ability?", "{ability}", "ability", "[]", "and", "{}", None, Some("medium"), 100),
            ("Pokemon Hidden Ability", "Ask about hidden ability", "simple_match", "What is {name}'s hidden ability?", "{hidden-ability}", "hidden-ability", "[]", "and", "{}", None, Some("hard"), 80),
            ("Pokemon Base Attack", "Ask about base attack stat", "simple_match", "What is {name}'s base attack stat?", "{attack}", "attack", "[]", "and", "{}", None, Some("hard"), 60),

            // Reverse Lookup templates
            ("Find by Type", "Find a Pokemon of a specific type", "reverse_lookup", "Name a {type} type Pokemon", "{name}", "type", r#"[{"attribute":"type","operator":"eq","value":"{type}"}]"#, "and", "{}", None, Some("easy"), 100),
            ("Find by Ability", "Find Pokemon with specific ability", "reverse_lookup", "Which Pokemon has the ability {ability}?", "{name}", "ability", r#"[{"attribute":"ability","operator":"eq","value":"{ability}"}]"#, "and", "{}", None, Some("medium"), 100),
            ("Find by Generation", "Find Pokemon from specific generation", "reverse_lookup", "Name a Pokemon from {generation}", "{name}", "generation", r#"[{"attribute":"generation","operator":"eq","value":"{generation}"}]"#, "and", "{}", None, Some("easy"), 100),

            // Superlative templates
            ("Highest Attack", "Find Pokemon with highest attack", "superlative", "Which Pokemon has the highest base attack stat?", "{name}", "attack", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"attack","count":1}"#), Some("hard"), 100),
            ("Fastest Pokemon", "Find Pokemon with highest speed", "superlative", "Which Pokemon has the highest speed stat?", "{name}", "speed", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"speed","count":1}"#), Some("hard"), 100),
            ("Heaviest Pokemon", "Find heaviest Pokemon", "superlative", "Which Pokemon is the heaviest?", "{name}", "weight-kg", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"weight-kg","count":1}"#), Some("medium"), 100),
            ("Highest BST", "Find Pokemon with highest base stat total", "superlative", "Which Pokemon has the highest base stat total?", "{name}", "base-stat-total", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"base-stat-total","count":1}"#), Some("hard"), 80),

            // Comparison templates
            ("Compare Attack", "Compare attack stats of two Pokemon", "comparison", "Which has higher attack: {pokemon_1} or {pokemon_2}?", "{name}", "attack", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"attack","count":2}"#), Some("medium"), 100),
            ("Compare Speed", "Compare speed stats", "comparison", "Which is faster: {pokemon_1} or {pokemon_2}?", "{name}", "speed", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"speed","count":2}"#), Some("medium"), 100),
            ("Compare Weight (4)", "Compare weight of four Pokemon", "comparison", "Between {pokemon_1}, {pokemon_2}, {pokemon_3}, and {pokemon_4}, which is the heaviest?", "{name}", "weight-kg", "[]", "and", "{}", Some(r#"{"operator":"max","attribute":"weight-kg","count":4}"#), Some("hard"), 80),

            // Multi-condition templates
            ("Type + Generation", "Find Pokemon matching type and generation", "multi_condition", "Which {type} type Pokemon is from {generation}?", "{name}", "type", r#"[{"attribute":"type","operator":"eq","value":"{type}"},{"attribute":"generation","operator":"eq","value":"{generation}"}]"#, "and", "{}", None, Some("medium"), 100),
            ("Type + Ability", "Find Pokemon matching type and ability", "multi_condition", "Which {type} type Pokemon has the ability {ability}?", "{name}", "type", r#"[{"attribute":"type","operator":"eq","value":"{type}"},{"attribute":"ability","operator":"eq","value":"{ability}"}]"#, "and", "{}", None, Some("hard"), 80),
            ("Legendary + Generation", "Find legendary from specific gen", "multi_condition", "Which legendary Pokemon is from {generation}?", "{name}", "legendary", r#"[{"attribute":"legendary","operator":"eq","value":"true"},{"attribute":"generation","operator":"eq","value":"{generation}"}]"#, "and", "{}", None, Some("medium"), 100),

            // Range templates
            ("High BST Range", "Find Pokemon in BST range", "range", "Which Pokemon has a base stat total between 500 and 600?", "{name}", "base-stat-total", r#"[{"attribute":"base-stat-total","operator":"between","values":["500","600"]}]"#, "and", "{}", None, Some("hard"), 100),
            ("Heavy Pokemon", "Find heavy Pokemon", "range", "Which Pokemon weighs more than 100kg?", "{name}", "weight-kg", r#"[{"attribute":"weight-kg","operator":"gt","value":"100"}]"#, "and", "{}", None, Some("medium"), 100),
            ("Fast Pokemon", "Find fast Pokemon", "range", "Which Pokemon has a speed stat above 100?", "{name}", "speed", r#"[{"attribute":"speed","operator":"gt","value":"100"}]"#, "and", "{}", None, Some("medium"), 100),

            // Negation templates
            ("Not Legendary", "Find non-legendary Pokemon", "negation", "Which of these Pokemon is NOT legendary?", "{name}", "legendary", r#"[{"attribute":"legendary","operator":"eq","value":"false"}]"#, "and", "{}", None, Some("easy"), 100),

            // Statistical templates
            ("Has Hidden Ability", "Find Pokemon with hidden ability", "statistical", "Which Pokemon has a hidden ability?", "{name}", "hidden-ability", r#"[{"attribute":"hidden-ability","operator":"exists"}]"#, "and", "{}", None, Some("medium"), 100),
            ("No Hidden Ability", "Find Pokemon without hidden ability", "statistical", "Which Pokemon does NOT have a hidden ability?", "{name}", "hidden-ability", r#"[{"attribute":"hidden-ability","operator":"not_exists"}]"#, "and", "{}", None, Some("hard"), 80),

            // Type Effectiveness templates
            ("4x Fire Weakness", "Find Pokemon with 4x fire weakness", "type_effectiveness", "Which Pokemon takes 4x damage from Fire moves?", "{name}", "against-fire", r#"[{"attribute":"against-fire","operator":"eq","value":"4"}]"#, "and", "{}", None, Some("medium"), 100),
            ("Ground Immunity", "Find Pokemon immune to Ground", "type_effectiveness", "Which Pokemon is immune to Ground moves?", "{name}", "against-ground", r#"[{"attribute":"against-ground","operator":"eq","value":"0"}]"#, "and", "{}", None, Some("easy"), 100),
            ("Electric Resistance", "Find Pokemon that resists Electric", "type_effectiveness", "Which Pokemon takes half damage from Electric moves?", "{name}", "against-electric", r#"[{"attribute":"against-electric","operator":"eq","value":"0.5"}]"#, "and", "{}", None, Some("medium"), 100),
        ];

        let templates_count = templates.len();
        for (name, description, template_type, question, answer, primary_attr, conditions, logic, scope, comparison, difficulty, weight) in templates {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO pokemon_trivia_templates_v2 (
                    id, name, description, template_type, question_template, answer_template,
                    primary_attribute, conditions, condition_logic, scope_filters,
                    comparison_config, difficulty, weight, is_active, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1, ?14, ?15)",
                rusqlite::params![
                    id, name, description, template_type, question, answer,
                    primary_attr, conditions, logic, scope,
                    comparison, difficulty, weight, now, now
                ],
            )
            .map_err(|e| format!("Failed to seed template '{}': {}", name, e))?;
        }

        log::info!("Seeded {} default Pokemon trivia templates v2", templates_count);
        Ok(())
    }

    /// Migration: Remove the "Not Water Type" negation template
    /// This template caused confusion because the answer selection logic dynamically
    /// picks the most common type (e.g., Psychic) while the question text says "Water"
    fn migrate_remove_not_water_type_template(conn: &Connection) -> Result<(), String> {
        let deleted = conn.execute(
            "DELETE FROM pokemon_trivia_templates_v2 WHERE name = 'Not Water Type'",
            [],
        )
        .map_err(|e| format!("Failed to delete Not Water Type template: {}", e))?;

        if deleted > 0 {
            log::info!("Removed 'Not Water Type' negation template from pokemon_trivia_templates_v2");
        }

        Ok(())
    }
}
