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
        // Create albums table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS albums (
                id TEXT PRIMARY KEY,
                album_type TEXT NOT NULL DEFAULT 'movie',
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
        .map_err(|e| format!("Failed to create albums table: {}", e))?;

        // Migration: Add album_type column if it doesn't exist
        Self::add_column_if_not_exists(conn, "albums", "album_type", "TEXT NOT NULL DEFAULT 'movie'")?;

        // Migration: Infer album_type from existing data
        Self::migrate_album_types(conn)?;

        // Create cards table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                album_id TEXT NOT NULL,
                name TEXT NOT NULL,
                image TEXT NOT NULL,
                musicbrainz_release_group_id TEXT,
                release_type TEXT,
                release_year INTEGER,
                added_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create cards table: {}", e))?;

        // Create sources table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                album_id TEXT NOT NULL,
                source_type TEXT NOT NULL,
                external_id TEXT NOT NULL,
                external_id_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
                UNIQUE(source_type, external_id_type, external_id)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create sources table: {}", e))?;

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

        // Migration: Add rarity_id column to cards if it doesn't exist
        Self::add_column_if_not_exists(conn, "cards", "rarity_id", "TEXT REFERENCES rarities(id) ON DELETE SET NULL")?;

        // Migration: Add card_type column to cards if it doesn't exist
        Self::add_column_if_not_exists(conn, "cards", "card_type", "TEXT NOT NULL DEFAULT 'other'")?;

        // Migration: Add image_source column to cards if it doesn't exist
        Self::add_column_if_not_exists(conn, "cards", "image_source", "TEXT")?;

        // Seed default rarities (WoW-style) if table is empty
        Self::seed_default_rarities(conn)?;

        // Create questions table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                album_id TEXT NOT NULL,
                question_text TEXT NOT NULL,
                answer_a TEXT NOT NULL,
                answer_b TEXT NOT NULL,
                answer_c TEXT NOT NULL,
                correct_answer TEXT NOT NULL CHECK(correct_answer IN ('a', 'b', 'c')),
                difficulty TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create questions table: {}", e))?;

        // Create torrents table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS torrents (
                id TEXT PRIMARY KEY,
                info_hash TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                source TEXT NOT NULL,
                download_dir TEXT NOT NULL,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                downloaded_bytes INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                added_at TEXT NOT NULL,
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create torrents table: {}", e))?;

        // Create torrent_files table if not exists
        conn.execute(
            "CREATE TABLE IF NOT EXISTS torrent_files (
                id TEXT PRIMARY KEY,
                torrent_id TEXT NOT NULL,
                file_index INTEGER NOT NULL,
                path TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("Failed to create torrent_files table: {}", e))?;

        // Create indexes for torrents
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_torrents_info_hash ON torrents(info_hash)",
            [],
        )
        .map_err(|e| format!("Failed to create torrents index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_torrents_status ON torrents(status)",
            [],
        )
        .map_err(|e| format!("Failed to create torrents status index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_torrent_files_torrent_id ON torrent_files(torrent_id)",
            [],
        )
        .map_err(|e| format!("Failed to create torrent_files index: {}", e))?;

        // EVM tables
        Self::create_evm_tables(conn)?;

        // Furniture table
        Self::create_furniture_table(conn)?;

        // Rooms table
        Self::create_rooms_table(conn)?;

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

    /// Migrate existing albums to infer album_type from their metadata
    fn migrate_album_types(conn: &Connection) -> Result<(), String> {
        // Update albums that have anime IDs to 'anime'
        conn.execute(
            "UPDATE albums SET album_type = 'anime'
             WHERE album_type = 'movie' AND (anilist_id IS NOT NULL OR mal_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate anime albums: {}", e))?;

        // Update albums that have videogame IDs to 'videogame'
        conn.execute(
            "UPDATE albums SET album_type = 'videogame'
             WHERE album_type = 'movie' AND (igdb_id IS NOT NULL OR sgdb_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate videogame albums: {}", e))?;

        // Update albums that have sports IDs to 'sports_league'
        conn.execute(
            "UPDATE albums SET album_type = 'sports_league'
             WHERE album_type = 'movie' AND (sports_db_team_id IS NOT NULL OR sports_db_league_id IS NOT NULL OR sports_db_player_id IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate sports albums: {}", e))?;

        // Update albums that have animal/wikidata IDs to 'animal'
        conn.execute(
            "UPDATE albums SET album_type = 'animal'
             WHERE album_type = 'movie' AND (wikidata_id IS NOT NULL AND scientific_name IS NOT NULL)",
            [],
        )
        .map_err(|e| format!("Failed to migrate animal albums: {}", e))?;

        // Update albums that have musicbrainz artist IDs to 'musician'
        conn.execute(
            "UPDATE albums SET album_type = 'musician'
             WHERE album_type = 'movie' AND musicbrainz_artist_id IS NOT NULL",
            [],
        )
        .map_err(|e| format!("Failed to migrate musician albums: {}", e))?;

        // Update albums that have open library author IDs to 'author'
        conn.execute(
            "UPDATE albums SET album_type = 'author'
             WHERE album_type = 'movie' AND open_library_author_id IS NOT NULL",
            [],
        )
        .map_err(|e| format!("Failed to migrate author albums: {}", e))?;

        // For remaining movie/tv - check sources table if possible
        // TV shows typically come from OMDB with type='series', but we need to check the source_type
        conn.execute(
            "UPDATE albums SET album_type = 'tv'
             WHERE album_type = 'movie'
             AND id IN (SELECT album_id FROM sources WHERE source_type = 'tv')",
            [],
        )
        .map_err(|e| format!("Failed to migrate TV albums: {}", e))?;

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

    /// Create EVM-related tables
    fn create_evm_tables(conn: &Connection) -> Result<(), String> {
        // EVM Accounts (EOA + Contracts)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_accounts (
                address TEXT PRIMARY KEY,
                balance TEXT NOT NULL DEFAULT '0',
                nonce INTEGER NOT NULL DEFAULT 0,
                code_hash TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_accounts table: {}", e))?;

        // Contract Bytecode (separate for efficiency)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_code (
                code_hash TEXT PRIMARY KEY,
                bytecode BLOB NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_code table: {}", e))?;

        // Contract Storage (key-value per contract)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_storage (
                address TEXT NOT NULL,
                slot TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (address, slot)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_storage table: {}", e))?;

        // Blocks
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_blocks (
                number INTEGER PRIMARY KEY,
                hash TEXT UNIQUE NOT NULL,
                parent_hash TEXT NOT NULL,
                state_root TEXT NOT NULL,
                transactions_root TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                proposer TEXT NOT NULL,
                signature TEXT
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_blocks table: {}", e))?;

        // Transactions
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_transactions (
                hash TEXT PRIMARY KEY,
                block_number INTEGER,
                from_address TEXT NOT NULL,
                to_address TEXT,
                value TEXT NOT NULL,
                input BLOB,
                nonce INTEGER NOT NULL,
                signature TEXT NOT NULL,
                status INTEGER DEFAULT 0,
                gas_used INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (block_number) REFERENCES evm_blocks(number)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_transactions table: {}", e))?;

        // Transaction Receipts
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_receipts (
                tx_hash TEXT PRIMARY KEY,
                block_number INTEGER NOT NULL,
                contract_address TEXT,
                logs BLOB,
                status INTEGER NOT NULL,
                gas_used INTEGER NOT NULL,
                FOREIGN KEY (tx_hash) REFERENCES evm_transactions(hash)
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_receipts table: {}", e))?;

        // Local Wallets (encrypted private keys)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evm_wallets (
                address TEXT PRIMARY KEY,
                private_key BLOB NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create evm_wallets table: {}", e))?;

        // Indexes for EVM tables
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_evm_storage_address ON evm_storage(address)",
            [],
        )
        .map_err(|e| format!("Failed to create evm_storage index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_evm_transactions_block ON evm_transactions(block_number)",
            [],
        )
        .map_err(|e| format!("Failed to create evm_transactions index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_evm_transactions_from ON evm_transactions(from_address)",
            [],
        )
        .map_err(|e| format!("Failed to create evm_transactions from index: {}", e))?;

        log::info!("EVM tables created successfully");
        Ok(())
    }

    /// Create furniture table for 3D models
    fn create_furniture_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS furniture (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                furniture_type TEXT NOT NULL DEFAULT 'decoration',
                model_path TEXT NOT NULL,
                scale REAL NOT NULL DEFAULT 1.0,
                thumbnail TEXT,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create furniture table: {}", e))?;

        // Index on furniture_type for filtering
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_furniture_type ON furniture(furniture_type)",
            [],
        )
        .map_err(|e| format!("Failed to create furniture type index: {}", e))?;

        // Seed default furniture if table is empty
        Self::seed_default_furniture(conn)?;

        log::info!("Furniture table created successfully");
        Ok(())
    }

    /// Seed default furniture items
    fn seed_default_furniture(conn: &Connection) -> Result<(), String> {
        // Check if furniture table is empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM furniture", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count > 0 {
            return Ok(()); // Already seeded
        }

        let now = chrono::Utc::now().to_rfc3339();

        // IKEA furniture items with appropriate scales
        let furniture_items = [
            (
                "ikea-linnmon-alex-desk",
                "IKEA Linnmon/Alex Desk",
                "table",
                "ikea_linnmonalex_desk/scene.gltf",
                0.01,
                "A classic IKEA desk combination with drawer unit",
            ),
            (
                "ikea-billy-long",
                "IKEA Billy Bookcase (Long)",
                "shelf",
                "ikea_billy_long/scene.gltf",
                0.01,
                "IKEA Billy bookcase - long configuration",
            ),
            (
                "ikea-kallax-77x147",
                "IKEA Kallax Shelf 77x147",
                "shelf",
                "ikea_kallax_77x147/scene.gltf",
                0.01,
                "IKEA Kallax shelf unit (77cm x 147cm)",
            ),
        ];

        for (id, name, furniture_type, model_path, scale, description) in furniture_items {
            conn.execute(
                "INSERT INTO furniture (id, name, furniture_type, model_path, scale, description, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![id, name, furniture_type, model_path, scale, description, now.clone(), now.clone()],
            )
            .map_err(|e| format!("Failed to seed furniture '{}': {}", name, e))?;
        }

        log::info!("Seeded {} default furniture items", furniture_items.len());
        Ok(())
    }

    /// Create rooms table for 3D room templates
    fn create_rooms_table(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                -- Dimensions
                dim_width REAL NOT NULL DEFAULT 8.0,
                dim_height REAL NOT NULL DEFAULT 4.0,
                dim_depth REAL NOT NULL DEFAULT 10.0,
                -- Movement bounds
                bounds_min_x REAL NOT NULL DEFAULT -3.5,
                bounds_max_x REAL NOT NULL DEFAULT 3.5,
                bounds_min_z REAL NOT NULL DEFAULT -4.0,
                bounds_max_z REAL NOT NULL DEFAULT 4.5,
                -- Colors (hex)
                color_floor TEXT NOT NULL DEFAULT '#8b7355',
                color_ceiling TEXT NOT NULL DEFAULT '#f5f5f5',
                color_walls TEXT NOT NULL DEFAULT '#e8e4de',
                -- Camera spawn
                camera_x REAL NOT NULL DEFAULT 0.0,
                camera_y REAL NOT NULL DEFAULT 1.4,
                camera_z REAL NOT NULL DEFAULT -0.8,
                camera_pitch REAL NOT NULL DEFAULT -0.35,
                -- Furniture (JSON array of RoomFurniture)
                furniture_json TEXT NOT NULL DEFAULT '[]',
                -- Optional thumbnail
                thumbnail TEXT,
                -- Timestamps
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create rooms table: {}", e))?;

        // Seed default room
        Self::seed_default_rooms(conn)?;

        log::info!("Rooms table created successfully");
        Ok(())
    }

    /// Seed default room matching the /game/room implementation
    fn seed_default_rooms(conn: &Connection) -> Result<(), String> {
        // Check if rooms table is empty
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM rooms", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if count > 0 {
            return Ok(()); // Already seeded
        }

        let now = chrono::Utc::now().to_rfc3339();

        // Furniture placements matching /game/room:
        // - IKEA desk at position (2.5, 0, -4.4)
        let furniture_json = r#"[
            {
                "furnitureId": "ikea-linnmon-alex-desk",
                "position": { "x": 2.5, "y": 0, "z": -4.4 },
                "rotation": { "x": 0, "y": 0, "z": 0 },
                "scale": 1.0
            }
        ]"#;

        conn.execute(
            "INSERT INTO rooms (
                id, name, description,
                dim_width, dim_height, dim_depth,
                bounds_min_x, bounds_max_x, bounds_min_z, bounds_max_z,
                color_floor, color_ceiling, color_walls,
                camera_x, camera_y, camera_z, camera_pitch,
                furniture_json,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
            rusqlite::params![
                "default-study",
                "Default Study",
                "The default study room with desk, chair, and bookshelf matching the /game/room layout",
                8.0,  // width
                4.0,  // height
                10.0, // depth
                -3.5, // bounds minX
                3.5,  // bounds maxX
                -4.0, // bounds minZ
                4.5,  // bounds maxZ
                "#8b7355", // floor color (wooden brown)
                "#f5f5f5", // ceiling color (light)
                "#e8e4de", // walls color (light beige)
                0.0,   // camera X
                1.4,   // camera Y (eye height)
                -0.8,  // camera Z (slightly forward from center)
                -0.35, // camera pitch (looking slightly down at desk)
                furniture_json,
                now.clone(),
                now
            ],
        )
        .map_err(|e| format!("Failed to seed default room: {}", e))?;

        log::info!("Seeded 1 default room");
        Ok(())
    }
}
