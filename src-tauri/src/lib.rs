mod apis;
mod commands;
mod db;
mod image_cache;
mod models;

use apis::{
    client::ApiClientState,
    config::{ApiConfig, ApiConfigState},
    igdb::IgdbApi,
};
use db::Database;
use image_cache::{
    cache_image, cache_images_batch, cancel_background_download, clear_image_cache,
    get_background_download_progress, get_cache_path, get_cache_stats, get_cached_image,
    reset_background_download, start_background_download, ImageCacheState,
};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
#[cfg(desktop)]
use tauri::LogicalSize;
use tauri::{Manager, State};

#[cfg(desktop)]
fn is_production() -> bool {
    std::env::var("ENVIRONMENT")
        .map(|v| v == "production")
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Register plugins
    builder = builder.plugin(tauri_plugin_shell::init());
    builder = builder.plugin(tauri_plugin_fs::init());
    builder = builder.plugin(tauri_plugin_store::Builder::default().build());
    builder = builder.plugin(tauri_plugin_os::init());
    builder = builder.plugin(tauri_plugin_dialog::init());
    builder = builder.plugin(tauri_plugin_http::init());

    // Single instance plugin (desktop only)
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}));
    }

    builder = builder.setup(|app| {
        // Load .env file from project root (for development)
        // In production, environment variables should be set by the system
        if let Err(e) = dotenvy::dotenv() {
            log::warn!("Could not load .env file: {}", e);
        }

        // Initialize database from app.db at project root
        let db = Database::init(app.handle())
            .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)) as Box<dyn std::error::Error>)?;
        app.manage(db);

        // Initialize image cache
        let cache_dir = app
            .path()
            .app_cache_dir()
            .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())) as Box<dyn std::error::Error>)?;
        std::fs::create_dir_all(&cache_dir)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
        log::info!("Image cache directory: {:?}", cache_dir);
        app.manage(ImageCacheState::new(cache_dir));

        // Initialize API client and config
        let api_client = ApiClientState::new()
            .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())) as Box<dyn std::error::Error>)?;
        app.manage(api_client);

        let api_config = ApiConfigState::new(ApiConfig::from_env());
        app.manage(api_config);

        // Initialize IGDB API (needs to maintain OAuth token state)
        app.manage(IgdbApi::new());

        // Build custom menu (desktop only)
        #[cfg(desktop)]
        {
            let admin_item = MenuItemBuilder::with_id("nav_admin", "Admin")
                .accelerator("CmdOrCtrl+Shift+A")
                .build(app)?;
            let game_item = MenuItemBuilder::with_id("nav_game", "Game")
                .accelerator("CmdOrCtrl+Shift+G")
                .build(app)?;

            let select_menu = if is_production() {
                // Production: only Game menu item
                SubmenuBuilder::new(app, "Select")
                    .item(&game_item)
                    .build()?
            } else {
                // Development: Admin and Game menu items
                SubmenuBuilder::new(app, "Select")
                    .item(&admin_item)
                    .item(&game_item)
                    .build()?
            };

            // Display menu - window sizes and fullscreen
            let size_mobile = MenuItemBuilder::with_id("size_mobile", "Mobile")
                .build(app)?;
            let size_800x600 = MenuItemBuilder::with_id("size_800x600", "800 × 600")
                .build(app)?;
            let size_1024x768 = MenuItemBuilder::with_id("size_1024x768", "1024 × 768")
                .build(app)?;
            let size_1280x720 = MenuItemBuilder::with_id("size_1280x720", "1280 × 720 (HD)")
                .build(app)?;
            let size_1920x1080 = MenuItemBuilder::with_id("size_1920x1080", "1920 × 1080 (Full HD)")
                .build(app)?;
            let size_2560x1440 = MenuItemBuilder::with_id("size_2560x1440", "2560 × 1440 (QHD)")
                .build(app)?;
            let maximize_item = MenuItemBuilder::with_id("display_maximize", "Maximize")
                .accelerator("CmdOrCtrl+Shift+M")
                .build(app)?;
            let fullscreen_item = MenuItemBuilder::with_id("display_fullscreen", "Toggle Fullscreen")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?;

            let display_menu = SubmenuBuilder::new(app, "Display")
                .item(&size_mobile)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&size_800x600)
                .item(&size_1024x768)
                .item(&size_1280x720)
                .item(&size_1920x1080)
                .item(&size_2560x1440)
                .item(&PredefinedMenuItem::separator(app)?)
                .item(&maximize_item)
                .item(&fullscreen_item)
                .build()?;

            let menu = Menu::with_items(app, &[&select_menu, &display_menu])?;
            app.set_menu(menu)?;
        }

        if cfg!(debug_assertions) {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
        }
        Ok(())
    });

    // Menu event handling (desktop only)
    #[cfg(desktop)]
    {
        builder = builder.on_menu_event(|app, event| {
            let window = app.get_webview_window("main").unwrap();
            match event.id().as_ref() {
                // Navigation
                "nav_admin" => {
                    let _ = window.eval("window.location.href = '/admin'");
                }
                "nav_game" => {
                    let _ = window.eval("window.location.href = '/game'");
                }
                // Display sizes
                "size_mobile" => {
                    let _ = window.set_size(LogicalSize::new(440, 956));
                }
                "size_800x600" => {
                    let _ = window.set_size(LogicalSize::new(800, 600));
                }
                "size_1024x768" => {
                    let _ = window.set_size(LogicalSize::new(1024, 768));
                }
                "size_1280x720" => {
                    let _ = window.set_size(LogicalSize::new(1280, 720));
                }
                "size_1920x1080" => {
                    let _ = window.set_size(LogicalSize::new(1920, 1080));
                }
                "size_2560x1440" => {
                    let _ = window.set_size(LogicalSize::new(2560, 1440));
                }
                "display_maximize" => {
                    let _ = window.maximize();
                }
                "display_fullscreen" => {
                    if let Ok(is_fullscreen) = window.is_fullscreen() {
                        let _ = window.set_fullscreen(!is_fullscreen);
                    }
                }
                _ => {}
            }
        });
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::get_settings,
            commands::update_settings,
            // Sources (formerly Albums)
            commands::get_all_sources,
            commands::get_source,
            commands::create_source,
            commands::update_source,
            commands::delete_source,
            // Stickers (formerly Blueprints/Templates)
            commands::get_all_stickers,
            commands::get_stickers_by_source,
            commands::get_sticker,
            commands::create_sticker,
            commands::create_stickers_batch,
            commands::update_sticker,
            commands::delete_sticker,
            commands::delete_stickers_by_source,
            // Providers (formerly Sources - external API tracking)
            commands::get_all_providers,
            commands::get_providers_by_source,
            commands::provider_exists,
            commands::get_provider_by_external_id,
            commands::create_provider,
            commands::delete_provider,
            // Rarities
            commands::get_all_rarities,
            commands::get_rarity,
            commands::create_rarity,
            commands::update_rarity,
            commands::delete_rarity,
            // Sticker Types (formerly Blueprint Types/Template Types)
            commands::get_all_sticker_types,
            commands::get_sticker_type,
            commands::get_sticker_types_by_category,
            commands::get_sticker_types_by_source_type,
            commands::create_sticker_type,
            commands::update_sticker_type,
            commands::delete_sticker_type,
            // Tags
            commands::get_all_tags,
            commands::get_tag,
            commands::get_tags_by_key,
            commands::create_tag,
            commands::update_tag,
            commands::delete_tag,
            // Sticker Tags (formerly Blueprint Tags/Template Tags)
            commands::get_tags_by_sticker,
            commands::add_tag_to_sticker,
            commands::remove_tag_from_sticker,
            commands::get_sticker_ids_by_tag,
            // Collections
            commands::get_all_collections,
            commands::get_collection,
            commands::get_collections_by_type,
            commands::create_collection,
            commands::update_collection,
            commands::delete_collection,
            commands::add_sticker_to_collection,
            commands::remove_sticker_from_collection,
            commands::get_stickers_for_collection,
            // Collection Types
            commands::get_all_collection_types,
            commands::get_collection_type,
            commands::create_collection_type,
            commands::update_collection_type,
            commands::delete_collection_type,
            // Questions (trivia)
            commands::get_all_questions,
            commands::get_questions_by_source,
            commands::get_question,
            commands::create_question,
            commands::update_question,
            commands::delete_question,
            commands::delete_questions_by_source,
            // Image cache
            get_cached_image,
            cache_image,
            cache_images_batch,
            get_cache_stats,
            clear_image_cache,
            get_cache_path,
            start_background_download,
            get_background_download_progress,
            cancel_background_download,
            reset_background_download,
            // API Fetch commands - Search
            commands::search_movies,
            commands::search_tv,
            commands::search_games,
            commands::search_anime,
            commands::search_sports_teams,
            commands::search_sports_leagues,
            commands::search_animals,
            // API Fetch commands - Batch fetch
            commands::fetch_source_images,
            // API Fetch commands - Helpers
            commands::get_species_in_genus,
            commands::get_teams_in_league,
            // API Fetch commands - Details
            commands::get_content_details,
            // API Config
            commands::get_api_config,
            commands::update_api_config,
            // Database introspection
            commands::get_database_tables,
            commands::get_table_columns,
            commands::get_table_data,
            // User Stickers (game data - _user_stickers table)
            commands::get_all_user_stickers,
            commands::get_user_stickers_by_source,
            commands::get_user_sticker,
            commands::user_owns_sticker,
            commands::get_user_sticker_copy_count,
            commands::get_user_unique_sticker_count_by_source,
            commands::get_user_owned_sticker_ids,
            commands::acquire_user_sticker,
            commands::release_user_sticker,
            commands::delete_user_sticker,
            commands::delete_user_stickers_by_source,
            commands::delete_all_user_stickers,
            // User Collections (game data - _user_collections table)
            commands::get_all_user_collections,
            commands::get_user_collection,
            commands::get_user_collection_by_collection_id,
            commands::get_completed_user_collections,
            commands::get_in_progress_user_collections,
            commands::create_user_collection,
            commands::update_user_collection,
            commands::mark_user_collection_completed,
            commands::delete_user_collection,
            commands::delete_user_collection_by_collection_id,
            commands::delete_all_user_collections,
            // User Sources (game data - _user_sources table)
            commands::get_all_user_sources,
            commands::get_user_source,
            commands::user_owns_source,
            commands::get_user_owned_source_ids,
            commands::acquire_user_source,
            commands::release_user_source,
            commands::delete_user_source,
            commands::delete_all_user_sources,
            // LLM Configs
            commands::get_all_llm_configs,
            commands::get_llm_config,
            commands::get_default_llm_config,
            commands::create_llm_config,
            commands::update_llm_config,
            commands::delete_llm_config,
            commands::set_default_llm_config,
            // LLM API
            commands::check_llm_server,
            commands::get_llm_models,
            commands::chat_llm,
            commands::get_llm_defaults,
            // Stamp Packs (imported stickers - WhatsApp, Telegram, etc.)
            commands::get_all_stamp_packs,
            commands::get_stamp_packs_by_source,
            commands::get_stamp_pack,
            commands::create_stamp_pack,
            commands::update_stamp_pack,
            commands::delete_stamp_pack,
            // Stamps (individual stickers within a pack)
            commands::get_all_stamps,
            commands::get_stamps_by_pack,
            commands::get_stamp,
            commands::create_stamp,
            commands::create_stamps_batch,
            commands::delete_stamp,
            commands::delete_stamps_by_pack,
            // Stamp Import (file operations)
            commands::get_stamps_data_dir,
            commands::copy_file_to_stamps_dir,
            commands::write_stamp_file,
            commands::delete_stamp_pack_files,
            // Utility
            commands::get_cwd,
            commands::read_award_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
