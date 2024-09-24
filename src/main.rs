// src/main.rs

use actix_web::{web, App, HttpServer, middleware};
use crate::handlers::{file_handler, graph_handler, ragflow_handler};
use crate::config::Settings;
use crate::AppState;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use crate::services::file_service::GitHubService;
use crate::models::graph::GraphData;
use crate::utils::websocket_manager::WebSocketManager;

mod app_state;
mod config;
mod handlers;
mod models;
mod services;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables.
    dotenv::dotenv().ok();

    // Initialise logger.
    env_logger::init();

    log::info!("Starting WebXR Graph Server");

    // Load settings.
    let settings = Settings::new().expect("Failed to load settings");

    // Initialise shared application state.
    let file_cache = Arc::new(RwLock::new(HashMap::new()));
    let graph_data = Arc::new(RwLock::new(GraphData::default()));
    let github_service = Arc::new(GitHubService::new());
    let websocket_manager = Arc::new(WebSocketManager::new());

    let app_state = web::Data::new(AppState {
        settings,
        file_cache,
        graph_data,
        github_service,
        websocket_manager,
    });

    // Start HTTP server.
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .wrap(middleware::Logger::default())
            // Register file handler routes.
            .service(
                web::scope("/api/files")
                    .route("/fetch", web::get().to(file_handler::fetch_and_process_files))
            )
            // Register graph handler routes.
            .service(
                web::scope("/api/graph")
                    .route("/data", web::get().to(graph_handler::get_graph_data))
            )
            // Register RAGFlow handler routes.
            .service(
                web::scope("/api/chat")
                    .route("/message", web::post().to(ragflow_handler::send_message))
                    .route("/init", web::post().to(ragflow_handler::init_chat))
                    .route("/history/{conversation_id}", web::get().to(ragflow_handler::get_chat_history))
            )
            // Serve static files (e.g., frontend files).
            .service(
                actix_files::Files::new("/", "./public").index_file("index.html")
            )
            // WebSocket route.
            .route("/ws", web::get().to(WebSocketManager::handle_websocket))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
