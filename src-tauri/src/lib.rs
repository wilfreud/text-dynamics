pub mod analysis;
pub mod commands;
pub mod error;
pub mod gemini;
pub mod persistence;
pub mod secrets;
pub mod state;

use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

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
                .rotation_strategy(RotationStrategy::KeepAll)
                .max_file_size(5_000_000)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let session_id = format!("sess_{}", uuid::Uuid::new_v4().simple());
            let log_dir = app
                .path()
                .app_log_dir()
                .unwrap_or_else(|_| std::env::temp_dir());

            let _ = std::fs::create_dir_all(&log_dir);
            log::info!(
                "[app] [session={}] app.started version={} log_dir={}",
                session_id,
                env!("CARGO_PKG_VERSION"),
                log_dir.display()
            );

            // Bounded retention for diagnostic log files (max 10 files, 30 days)
            let _ = persistence::prune_log_files(&log_dir, 10, 30);

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            std::fs::create_dir_all(&app_data_dir)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            let db_path = app_data_dir.join("text_dynamics.db");
            log::info!(
                "[database] [session={}] backend=sqlite uri=sqlite:text_dynamics.db resolved_path={} open=pending",
                session_id,
                db_path.display()
            );

            let db = persistence::Database::new(&db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            log::info!(
                "[database] [session={}] backend=sqlite resolved_path={} open=ok",
                session_id,
                db.resolved_path()
            );

            // Bounded retention for SQLite activity events (90 days, max 50,000 events)
            let _ = persistence::prune_activity_events(&db, 90, 50_000);

            // Record initial app.started user-facing activity
            let _ = persistence::record_activity_event(
                &db,
                persistence::NewActivityEvent {
                    session_id: &session_id,
                    document_id: None,
                    category: "app",
                    event_name: "app.started",
                    level: "info",
                    message: Some("Application started"),
                    metadata_json: Some(&serde_json::json!({ "version": env!("CARGO_PKG_VERSION") }).to_string()),
                    source: Some("app"),
                },
            );

            let secrets = secrets::KeyringStore::new();
            let cred_diag = secrets.diagnostics();
            log::info!(
                "[credential] [session={}] backend={} service={} account={} status={:?}",
                session_id,
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

            app.manage(state::AppState::new(db, secrets, session_id, log_dir));

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
            commands::history::list_activity_events,
            commands::history::list_sessions,
            commands::history::get_current_session_id,
            commands::history::list_diagnostic_logs,
            commands::history::open_logs_folder,
            commands::history::clear_activity_history,
            commands::history::clear_diagnostic_logs,
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
        .run(|app_handle, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    for window in app_handle.webview_windows().values() {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            tauri::RunEvent::Exit => {
                log::info!("[app] app.stopped");
            }
            _ => {}
        });
}
