#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;
mod db;
mod model;
mod music;

use std::cell::RefCell;
use std::rc::Rc;

use db::Db;
use model::Note;
use slint::{ModelRc, VecModel};

slint::include_modules!();

/// UI-side state that outlives individual callbacks.
struct AppState {
    all_notes: Vec<Note>,
    current: Option<usize>, // index into all_notes
    transpose: i32,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db = Db::open()?;
    let notes = db.list_notes()?;

    let state = Rc::new(RefCell::new(AppState {
        all_notes: notes,
        current: None,
        transpose: 0,
    }));

    let app = AppWindow::new()?;
    let store = app.global::<Store>();

    // Initial feed.
    refresh_feed(&app, &state.borrow().all_notes);
    store.set_page(0);

    // open-note
    {
        let app_weak = app.as_weak();
        let state = state.clone();
        store.on_open_note(move |id| {
            let app = app_weak.unwrap();
            let mut st = state.borrow_mut();
            if let Some(idx) = st.all_notes.iter().position(|n| n.id == id.as_str()) {
                st.current = Some(idx);
                st.transpose = 0;
                let detail = bridge::build_detail(&st.all_notes[idx], 0);
                app.global::<Store>().set_detail(detail);
                app.global::<Store>().set_page(1);
            }
        });
    }

    // back
    {
        let app_weak = app.as_weak();
        store.on_back(move || {
            app_weak.unwrap().global::<Store>().set_page(0);
        });
    }

    // search
    {
        let app_weak = app.as_weak();
        let state = state.clone();
        store.on_search(move |query| {
            let app = app_weak.unwrap();
            let st = state.borrow();
            let filtered: Vec<Note> = st
                .all_notes
                .iter()
                .filter(|n| bridge::matches_query(n, query.as_str()))
                .cloned()
                .collect();
            refresh_feed(&app, &filtered);
        });
    }

    // set-transpose (absolute steps)
    {
        let app_weak = app.as_weak();
        let state = state.clone();
        store.on_set_transpose(move |steps| {
            let app = app_weak.unwrap();
            let mut st = state.borrow_mut();
            st.transpose = steps;
            if let Some(idx) = st.current {
                let detail = bridge::build_detail(&st.all_notes[idx], steps);
                app.global::<Store>().set_detail(detail);
            }
        });
    }

    // new-note (editor UI is a follow-up)
    store.on_new_note(|| {
        eprintln!("Create/Edit UI is not implemented in this build yet.");
    });

    app.run()?;
    Ok(())
}

fn refresh_feed(app: &AppWindow, notes: &[Note]) {
    let summaries: Vec<NoteSummary> = notes.iter().map(bridge::to_summary).collect();
    let model: ModelRc<NoteSummary> = ModelRc::new(VecModel::from(summaries));
    app.global::<Store>().set_notes(model);
}
