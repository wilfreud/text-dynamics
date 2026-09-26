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
            log::info!("Initializing SQLite database at: {}", db_path.display());

            let db = persistence::Database::new(&db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            let secrets = secrets::KeyringStore::new();
            app.manage(state::AppState::new(db, secrets));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::documents::create_document,
            commands::documents::get_document,
            commands::documents::update_document,
            commands::documents::delete_document,
            commands::documents::list_documents,
            commands::settings::get_setting,
            commands::settings::save_setting,
            commands::settings::has_api_key,
            commands::settings::set_api_key,
            commands::settings::delete_api_key,
            commands::settings::list_gemini_models,
            commands::analysis::analyze_document,
            commands::analysis::get_latest_analysis,
            commands::analysis::save_analysis_overrides,
            commands::analysis::get_analysis_overrides,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
