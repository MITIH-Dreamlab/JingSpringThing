use std::sync::{Arc, RwLock};
use actix_web::{web, body::to_bytes, test, http::StatusCode};
use serde_json::json;

// Import your AppState and GraphData structs
use crate::AppState;
use crate::models::graph::GraphData;

// Import the function to be tested
use crate::handlers::file_handler::fetch_and_process_files;

// Import the services and models
use crate::services::file_service::{GithubFile, GitHubService, FileService, ProcessedFile};
use crate::services::perplexity_service::{PerplexityService, ApiClient, PerplexityError};
use crate::config::{Settings, PerplexityConfig};

#[actix_web::test]
async fn test_fetch_and_process_files() {
    let app_state = AppState::new(
        Arc::new(RwLock::new(GraphData::default())),
        Arc::new(RwLock::new(Default::default())),
    );

    let app_state = web::Data::new(app_state);
    let result = fetch_and_process_files(app_state).await;
    
    assert_eq!(result.status(), actix_web::http::StatusCode::OK);
    
    let body = to_bytes(result.into_body()).await.unwrap();
    let processed_files: Vec<String> = serde_json::from_slice(&body).unwrap();
    assert_eq!(processed_files.len(), 2);
    assert!(processed_files.contains(&"expected_file_name_1".to_string()));
    assert!(processed_files.contains(&"expected_file_name_2".to_string()));
}