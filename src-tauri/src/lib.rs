use std::{fs, ops::Deref};

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::Manager as _;
use tauri_plugin_sql::Migration;

#[derive(sqlx::FromRow, Serialize, Deserialize)]
struct Todo {
    id: Option<i64>,
    title: String,
    completed: bool,

    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
}

#[tauri::command]
async fn create_todo(
    db: tauri::State<'_, sqlx::sqlite::SqlitePool>,
    title: String,
) -> Result<Todo, String> {
    let now = chrono::Utc::now().timestamp();
    let todo = sqlx::query_as::<_, Todo>(
        "INSERT INTO todos (title, created_at) VALUES (?, ?) RETURNING *",
    )
    .bind(title)
    .bind(now)
    .fetch_one(db.deref())
    .await
    .map_err(|e| e.to_string())?;
    Ok(todo)
}

#[tauri::command]
async fn delete_todo(
    db: tauri::State<'_, sqlx::sqlite::SqlitePool>,
    id: i64,
) -> Result<(), String> {
    sqlx::query("DELETE FROM todos WHERE id = ?")
        .bind(id)
        .execute(db.deref())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn toggle_completed(
    db: tauri::State<'_, sqlx::sqlite::SqlitePool>,
    id: i64,
) -> Result<Todo, String> {
    let todo = sqlx::query_as::<_, Todo>("SELECT * FROM todos WHERE id = ?")
        .bind(id)
        .fetch_one(db.deref())
        .await
        .map_err(|e| e.to_string())?;

    let completed = !todo.completed;
    sqlx::query("UPDATE todos SET completed = ? WHERE id = ?")
        .bind(completed)
        .bind(id)
        .execute(db.deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(Todo {
        id: todo.id,
        title: todo.title,
        completed,
        created_at: todo.created_at,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(
                    "sqlite:todos.db",
                    vec![Migration {
                        version: 1,
                        description: "create_todos_table",
                        sql: "
                        CREATE TABLE IF NOT EXISTS todos (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            completed BOOLEAN NOT NULL DEFAULT 0,
                            created_at INTEGER NOT NULL
                        )",
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            create_todo,
            delete_todo,
            toggle_completed
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let app_path = app
        .path()
        .app_config_dir()
        .expect("No App config path was found!");

    let db_path = app_path.join("todos.db");
    let db_path_str = format!("sqlite:{}", db_path.to_string_lossy());

    let pool = tauri::async_runtime::block_on(async {
        let db_dir = std::path::Path::new(&db_path).parent().unwrap();

        // If the parent directory does not exist, create it.
        if !db_dir.exists() {
            fs::create_dir_all(db_dir).unwrap();
        }

        fs::File::create(db_path).expect("Failed to create database file");

        SqlitePool::connect(&db_path_str)
            .await
            .expect("Failed to connect to database")
    });

    app.manage(pool);
    app.run(|_, _| {});
}
