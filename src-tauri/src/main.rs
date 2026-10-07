#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod automation;
mod commands;
mod config;
mod desktop;
mod hotkeys;
mod input;
mod media;
mod perf;
mod protocol;
mod state;
mod sysmon;
mod tray;
mod wallpaper;

use tauri::{Manager, RunEvent, WindowEvent};

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| tray::show_settings(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(hotkeys::plugin())
        .register_asynchronous_uri_scheme_protocol("wallvid", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            std::thread::spawn(move || responder.respond(protocol::handle(&app, &request)));
        })
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(state::AppState::load(&handle)?);
            app.manage(hotkeys::HotkeyMap::default());
            tray::create(&handle)?;
            wallpaper::sync(&handle, true);
            for e in hotkeys::apply(&handle) {
                eprintln!("[aquawall] hotkey: {e}");
            }
            perf::spawn(handle.clone());
            input::spawn(handle.clone());
            sysmon::spawn(handle.clone());
            audio::spawn(handle.clone());
            automation::spawn(handle.clone());
            if !std::env::args().any(|a| a == "--minimized") {
                tray::show_settings(&handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "settings" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_config,
            commands::list_monitors,
            commands::get_targets,
            commands::get_playback,
            commands::diagnostics,
            commands::reattach,
            commands::set_paused,
            commands::step_wallpaper,
            commands::hotkey_errors,
            commands::list_window_apps,
            commands::tool_status,
            commands::import_url,
            commands::bake_video,
            commands::ensure_nature,
            commands::cancel_job,
            commands::open_folder,
            commands::save_image,
            commands::write_text_file,
            commands::read_text_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building AquaWall");

    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, code, .. } if code.is_none() => api.prevent_exit(),
        RunEvent::Exit => wallpaper::shutdown(app),
        _ => {}
    });
}
