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
    fn run_migrations(_conn: &Connection) -> Result<(), String> {
        // Add migrations here as needed
        // Example:
        // let has_column: bool = conn.prepare("SELECT col FROM table LIMIT 1").is_ok();
        // if !has_column {
        //     conn.execute("ALTER TABLE table ADD COLUMN col TYPE DEFAULT val", [])
        //         .map_err(|e| e.to_string())?;
        // }

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
}
