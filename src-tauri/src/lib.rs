mod commands;
mod db;
mod image_cache;
mod models;

use db::Database;
use image_cache::{
    cache_image, cache_images_batch, clear_image_cache, get_cache_path, get_cache_stats,
    get_cached_image, ImageCacheState,
};
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
#[cfg(desktop)]
use tauri::LogicalSize;
use tauri::Manager;

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

    // Single instance plugin (desktop only)
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}));
    }

    builder = builder.setup(|app| {
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

        // Build custom menu (desktop only)
        #[cfg(desktop)]
        {
            let home_item = MenuItemBuilder::with_id("nav_home", "Home")
                .accelerator("CmdOrCtrl+Shift+H")
                .build(app)?;

            let select_menu = if is_production() {
                // Production: only Home menu item
                SubmenuBuilder::new(app, "Select")
                    .item(&home_item)
                    .build()?
            } else {
                // Development: Admin and Home menu items
                let admin_item = MenuItemBuilder::with_id("nav_admin", "Admin")
                    .accelerator("CmdOrCtrl+Shift+A")
                    .build(app)?;
                SubmenuBuilder::new(app, "Select")
                    .item(&admin_item)
                    .item(&home_item)
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
                "nav_home" => {
                    let _ = window.eval("window.location.href = '/'");
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
            // Items (example CRUD resource)
            commands::get_all_items,
            commands::get_item,
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            // Image cache
            get_cached_image,
            cache_image,
            cache_images_batch,
            get_cache_stats,
            clear_image_cache,
            get_cache_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
