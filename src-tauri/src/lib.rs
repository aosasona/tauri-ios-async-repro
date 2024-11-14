use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use tauri::{AppHandle, Manager as _};
use tauri_plugin_sql::Migration;

const DB_NAME: &str = "todo.db";

macro_rules! dsn {
    () => {
        format!("sqlite:{}", DB_NAME).as_str()
    };
}

struct AppState {
    db: Arc<SqlitePool>,
}

#[derive(sqlx::FromRow, Serialize, Deserialize)]
struct Todo {
    id: Option<i64>,
    title: String,
    completed: bool,

    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
}

#[tauri::command]
async fn create_todo(state: tauri::State<'_, AppState>, data: Todo) -> Result<Todo, String> {
    let db = state.db.clone();
    let mut conn = db.acquire().await.unwrap();

    let row = sqlx::query_as::<_, Todo>(
        r#"
        INSERT INTO todos (title, completed, created_at)
        VALUES ($1, $2, $3)
        RETURNING id, title, completed, created_at
        "#,
    )
    .bind(data.title)
    .bind(data.completed)
    .bind(chrono::Utc::now().timestamp())
    .fetch_one(&mut *conn)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row)
}

#[tauri::command]
async fn get_all_todos(state: tauri::State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let db = state.db.clone();
    let mut conn = db.acquire().await.unwrap();

    let rows = sqlx::query_as::<_, Todo>(
        r#"
        SELECT id, title, completed, created_at
        FROM todos
        "#,
    )
    .fetch_all(&mut *conn)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

async fn setup(app: &AppHandle) {
    log::info!("Setting up the app");
    let raw_db_pool = SqlitePool::connect(dsn!())
        .await
        .expect("Failed to initialize database");
    let db_pool = Arc::new(raw_db_pool);

    log::info!("Setting up state management");
    app.manage(AppState { db: db_pool });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations: Vec<Migration> = vec![Migration {
        version: 1,
        description: "create_todos_table",
        sql: "CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        kind: tauri_plugin_sql::MigrationKind::Up,
    }];

    // NOTE: uncomment to use `.manage`
    // let raw_db_pool = tauri::async_runtime::block_on(async {
    //     SqlitePool::connect(dsn!())
    //         .await
    //         .expect("Failed to initialize database")
    // });
    // let db_pool = Arc::new(raw_db_pool);

    tauri::Builder::default()
        // .manage(AppState { db: db_pool }) // NOTE: uncomment to use `.manage`
        .setup(|app: &mut tauri::App| {
            tauri::async_runtime::block_on(async {
                setup(app.handle()).await;
            });

            Ok(())
        })
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(dsn!(), migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![create_todo, get_all_todos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
