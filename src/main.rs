// src/main.rs

use actix_web::{web, App, HttpServer, middleware};
use crate::handlers::{file_handler, graph_handler, ragflow_handler};
use crate::config::Settings;
use crate::app_state::AppState;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use crate::services::file_service::{GitHubService, RealGitHubService, FileService};
use crate::services::perplexity_service::PerplexityServiceImpl;
use crate::services::ragflow_service::RAGFlowService;
use crate::models::graph::GraphData;
use crate::utils::websocket_manager::WebSocketManager;
use crate::utils::gpu_compute::GPUCompute;
use crate::services::graph_service::GraphService;

mod app_state;
mod config;
mod handlers;
mod models;
mod services;
mod utils;

async fn initialize_graph_data(app_state: &web::Data<AppState>) -> std::io::Result<()> {
    log::info!("Initializing graph data...");
    
    match FileService::fetch_and_process_files(&*app_state.github_service, &app_state.settings).await {
        Ok(processed_files) => {
            log::info!("Successfully processed {} files", processed_files.len());

            // Update the file cache with processed content
            {
                let mut file_cache = app_state.file_cache.write().await;
                for processed_file in &processed_files {
                    file_cache.insert(processed_file.file_name.clone(), processed_file.content.clone());
                }
            }

            // Update graph data structure based on processed files
            match GraphService::build_graph(&app_state).await {
                Ok(graph_data) => {
                    let mut graph = app_state.graph_data.write().await;
                    *graph = graph_data;
                    log::info!("Graph data structure initialized successfully");
                    Ok(())
                },
                Err(e) => {
                    log::error!("Failed to build graph data: {}", e);
                    Err(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to build graph data: {}", e)))
                }
            }
        },
        Err(e) => {
            log::error!("Error processing files: {:?}", e);
            Err(std::io::Error::new(std::io::ErrorKind::Other, format!("Error processing files: {:?}", e)))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables.
    dotenv::dotenv().ok();
    println!("Environment: {:?}", std::env::vars().collect::<Vec<_>>());


    // Initialise logger.
    env_logger::init();

    log::info!("Starting WebXR Graph Server");

    // Load settings.
    let settings = Settings::new().expect("Failed to load settings");

    // Initialise shared application state.
    let file_cache = Arc::new(RwLock::new(HashMap::new()));
    let graph_data = Arc::new(RwLock::new(GraphData::default()));
    let github_service: Arc<dyn GitHubService + Send + Sync> = Arc::new(RealGitHubService::new());
    let perplexity_service: PerplexityServiceImpl = PerplexityServiceImpl::new();
    let websocket_manager = Arc::new(WebSocketManager::new());
    
    // Initialize GPUCompute
    let gpu_compute = Arc::new(RwLock::new(GPUCompute::new().await.expect("Failed to initialize GPUCompute"))); 

    let app_state = web::Data::new(AppState::new(
        graph_data,
        file_cache,
        settings,
        github_service,
        perplexity_service,
        websocket_manager,
        gpu_compute,
    ));

    // Initialize graph data
    initialize_graph_data(&app_state).await?;

    // Start HTTP server
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