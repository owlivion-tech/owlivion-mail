//! System Tray Implementation
//!
//! Provides system tray/panel icon functionality with menu actions.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

/// Get tray icon - use white icon for better visibility on dark panels
fn get_tray_icon() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    // Use 512x512 white icon for maximum size and quality
    let icon_bytes: &[u8] = include_bytes!("../icons/512x512-white.png");

    log::info!("Loading tray icon from 512x512-white.png");

    // Decode PNG image
    let img = image::load_from_memory(icon_bytes)?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let raw_pixels = rgba.into_raw();

    log::info!("Tray icon decoded: {}x{}", width, height);

    // Create Tauri Image
    Ok(Image::new_owned(raw_pixels, width, height))
}

/// Setup system tray icon and menu
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Setting up system tray...");

    // Get tray icon
    let tray_icon = match get_tray_icon() {
        Ok(icon) => {
            log::info!("Tray icon loaded successfully");
            icon
        }
        Err(e) => {
            log::error!("Failed to load tray icon: {}", e);
            return Err(e);
        }
    };

    // System tray menu with 3 options
    let open_item = MenuItem::with_id(app, "open", "Owlivion Mail'i Aç", true, None::<&str>)?;
    let compose_item = MenuItem::with_id(app, "compose", "Yeni Mail Yaz", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &compose_item, &quit_item])?;

    // Create tray with menu
    let tray = TrayIconBuilder::with_id("main-tray")
        .icon(tray_icon)
        .menu(&menu)
        .tooltip("Owlivion Mail")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "open" => {
                    // Show and focus main window
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
                "compose" => {
                    // Show window first, then trigger compose
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                        // Emit event to frontend to open compose modal (matches existing listener)
                        let _ = window.emit("tray:new-email", ());
                    }
                }
                "quit" => {
                    // Exit application
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Handle ALL tray icon clicks (both left and right) - always show window
            // Note: GNOME AppIndicator doesn't support direct click events, menu is required
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } | TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map_err(|e| {
            log::error!("Failed to build tray: {}", e);
            Box::new(e)
        })?;

    log::info!("System tray initialized successfully");

    // Keep tray alive - don't drop it
    std::mem::forget(tray);

    Ok(())
}
