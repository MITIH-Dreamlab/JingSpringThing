use actix_web::{web, HttpResponse};
use serde_json::json;
use log::{info, error, debug};
use crate::AppState;
use crate::services::file_service::FileService;
use crate::services::graph_service::GraphService;
use std::collections::HashMap;

pub async fn fetch_and_process_files(state: web::Data<AppState>) -> HttpResponse {
    info!("Initiating file fetch and processing");

    let mut metadata_map = FileService::load_or_create_metadata().unwrap_or_else(|_| HashMap::new());
    
    match FileService::fetch_and_process_files(&*state.github_service, state.settings.clone(), &mut metadata_map).await {
        Ok(processed_files) => {
            let file_names: Vec<String> = processed_files.iter()
                .map(|pf| pf.file_name.clone())
                .collect();

            info!("Successfully processed {} files", processed_files.len());

            {
                let mut file_cache = state.file_cache.write().await;
                for processed_file in &processed_files {
                    if processed_file.is_public {
                        metadata_map.insert(processed_file.file_name.clone(), processed_file.metadata.clone());
                    }
                    
                    file_cache.insert(processed_file.file_name.clone(), processed_file.content.clone());
                    debug!("Updated file cache with: {}", processed_file.file_name);
                }
            }

            // Save the updated metadata
            if let Err(e) = FileService::save_metadata(&metadata_map) {
                error!("Failed to save metadata: {}", e);
            }

            match GraphService::build_graph(&state).await {
                Ok(graph_data) => {
                    let mut graph = state.graph_data.write().await;
                    *graph = graph_data.clone();
                    info!("Graph data structure updated successfully");

                    let broadcast_result = state.websocket_manager.broadcast_message(&json!({
                        "type": "graphUpdate",
                        "data": graph_data,
                    }).to_string()).await;

                    match broadcast_result {
                        Ok(_) => debug!("Graph update broadcasted successfully"),
                        Err(e) => error!("Failed to broadcast graph update: {}", e),
                    }

                    HttpResponse::Ok().json(json!({
                        "status": "success",
                        "processed_files": file_names
                    }))
                },
                Err(e) => {
                    error!("Failed to build graph data: {}", e);
                    HttpResponse::InternalServerError().json(json!({
                        "status": "error",
                        "message": format!("Failed to build graph data: {}", e)
                    }))
                }
            }
        },
        Err(e) => {
            error!("Error processing files: {:?}", e);
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": format!("Error processing files: {:?}", e)
            }))
        }
    }
}

pub async fn get_file_content(state: web::Data<AppState>, file_name: web::Path<String>) -> HttpResponse {
    let file_cache = state.file_cache.read().await;
    
    match file_cache.get(file_name.as_str()) {
        Some(content) => HttpResponse::Ok().body(content.clone()),
        None => {
            error!("File not found in cache: {}", file_name);
            HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("File not found: {}", file_name)
            }))
        }
    }
}

pub async fn refresh_graph(state: web::Data<AppState>) -> HttpResponse {
    info!("Manually triggering graph refresh");

    match GraphService::build_graph(&state).await {
        Ok(graph_data) => {
            let mut graph = state.graph_data.write().await;
            *graph = graph_data.clone();
            info!("Graph data structure refreshed successfully");

            let broadcast_result = state.websocket_manager.broadcast_message(&json!({
                "type": "graphUpdate",
                "data": graph_data,
            }).to_string()).await;

            match broadcast_result {
                Ok(_) => debug!("Graph update broadcasted successfully"),
                Err(e) => error!("Failed to broadcast graph update: {}", e),
            }

            HttpResponse::Ok().json(json!({
                "status": "success",
                "message": "Graph refreshed successfully"
            }))
        },
        Err(e) => {
            error!("Failed to refresh graph data: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": format!("Failed to refresh graph data: {}", e)
            }))
        }
    }
}
