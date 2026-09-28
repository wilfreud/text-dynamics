pub mod analysis;
pub mod commands;
pub mod error;
pub mod gemini;
pub mod persistence;
pub mod secrets;
pub mod state;

use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

#[tauri::command]
fn greet(name: &str) -> String {
    log::info!("Greet command invoked with name: {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn sync_word_wrap_menu(app: tauri::AppHandle, checked: bool) -> Result<(), String> {
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get("toggle_word_wrap") {
            if let Some(check_item) = item.as_check_menuitem() {
                check_item.set_checked(checked).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(Target::new(TargetKind::Stdout))
                .target(Target::new(TargetKind::LogDir { file_name: None }))
                .target(Target::new(TargetKind::Webview))
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            let db_path = app_data_dir.join("text_dynamics.db");
            log::info!(
                "[database] backend=sqlite uri=sqlite:text_dynamics.db resolved_path={} open=pending",
                db_path.display()
            );

            let db = persistence::Database::new(&db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            log::info!(
                "[database] backend=sqlite resolved_path={} open=ok",
                db.resolved_path()
            );

            let secrets = secrets::KeyringStore::new();
            let cred_diag = secrets.diagnostics();
            log::info!(
                "[credential] backend={} service={} account={} status={:?}",
                cred_diag.backend,
                cred_diag.service,
                cred_diag.account,
                cred_diag.status
            );

            let toggle_wrap = tauri::menu::CheckMenuItemBuilder::with_id("toggle_word_wrap", "Word Wrap")
                .accelerator("Alt+Z")
                .checked(true)
                .build(app)?;

            let view_menu = tauri::menu::SubmenuBuilder::new(app, "View")
                .item(&toggle_wrap)
                .separator()
                .item(&tauri::menu::PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            #[cfg(target_os = "macos")]
            let app_menu = tauri::menu::SubmenuBuilder::new(app, "Text Dynamics")
                .item(&tauri::menu::PredefinedMenuItem::about(app, None, None)?)
                .separator()
                .item(&tauri::menu::PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&tauri::menu::PredefinedMenuItem::hide(app, None)?)
                .item(&tauri::menu::PredefinedMenuItem::hide_others(app, None)?)
                .item(&tauri::menu::PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&tauri::menu::PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let mut menu_builder = tauri::menu::MenuBuilder::new(app);
            #[cfg(target_os = "macos")]
            {
                menu_builder = menu_builder.item(&app_menu);
            }

            let menu = menu_builder
                .item(&tauri::menu::SubmenuBuilder::new(app, "File")
                    .item(&tauri::menu::PredefinedMenuItem::close_window(app, None)?)
                    .build()?)
                .item(&tauri::menu::SubmenuBuilder::new(app, "Edit")
                    .item(&tauri::menu::PredefinedMenuItem::undo(app, None)?)
                    .item(&tauri::menu::PredefinedMenuItem::redo(app, None)?)
                    .separator()
                    .item(&tauri::menu::PredefinedMenuItem::cut(app, None)?)
                    .item(&tauri::menu::PredefinedMenuItem::copy(app, None)?)
                    .item(&tauri::menu::PredefinedMenuItem::paste(app, None)?)
                    .item(&tauri::menu::PredefinedMenuItem::select_all(app, None)?)
                    .build()?)
                .item(&view_menu)
                .item(&tauri::menu::SubmenuBuilder::new(app, "Window")
                    .item(&tauri::menu::PredefinedMenuItem::minimize(app, None)?)
                    .item(&tauri::menu::PredefinedMenuItem::maximize(app, None)?)
                    .build()?)
                .build()?;

            app.set_menu(menu)?;

            app.manage(state::AppState::new(db, secrets));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            sync_word_wrap_menu,
            commands::documents::create_document,
            commands::documents::get_document,
            commands::documents::update_document,
            commands::documents::delete_document,
            commands::documents::list_documents,
            commands::settings::get_setting,
            commands::settings::save_setting,
            commands::settings::get_api_key_status,
            commands::settings::has_api_key,
            commands::settings::set_api_key,
            commands::settings::delete_api_key,
            commands::settings::get_runtime_diagnostics,
            commands::settings::list_gemini_models,
            commands::analysis::analyze_document,
            commands::analysis::get_latest_analysis,
            commands::analysis::save_analysis_overrides,
            commands::analysis::get_analysis_overrides,
        ])
        .on_menu_event(|app, event| {
            if event.id() == "toggle_word_wrap" {
                use tauri::Emitter;
                log::info!("[menu] toggle_word_wrap clicked in native menu");
                let _ = app.emit("menu:toggle-word-wrap", ());
                for window in app.webview_windows().values() {
                    let _ = window.emit("menu:toggle-word-wrap", ());
                }
            }
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    for window in app_handle.webview_windows().values() {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
