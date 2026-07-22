#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // On Linux, WebKitGTK's DMABUF renderer produces a blank/black WebView on
    // some GPU/driver combos. The usual workaround is disabling compositing
    // entirely, but that forces every frame (including scrolling) to be painted
    // on the CPU — causing scroll lag and high CPU/fan usage. Disabling only the
    // DMABUF renderer keeps GPU-accelerated compositing (smooth scrolling) while
    // still avoiding the blank-window bug. Must be set before the WebView starts.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
