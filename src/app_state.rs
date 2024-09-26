// app_state.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::graph::GraphData;
use crate::config::Settings;
use crate::services::file_service::GitHubService; // Import GitHubService
use crate::services::perplexity_service::PerplexityServiceImpl; // Import PerplexityServiceImpl 
use crate::utils::websocket_manager::WebSocketManager;
use crate::utils::gpu_compute::GPUCompute;

/// Holds the shared application state accessible across different parts of the application.
pub struct AppState {
    /// Shared graph data protected by a read-write lock.
    pub graph_data: Arc<RwLock<GraphData>>,
    /// Cache for file contents protected by a read-write lock.
    pub file_cache: Arc<RwLock<HashMap<String, String>>>,
    /// Application settings.
    pub settings: Settings,
    /// GitHub service for interacting with GitHub API.
    pub github_service: Arc<dyn GitHubService + Send + Sync>,
    /// Perplexity service for processing files.  
    // NOTE: We're using the concrete type now, not the trait object.
    pub perplexity_service: PerplexityServiceImpl, 
    /// WebSocket manager for handling WebSocket connections.
    pub websocket_manager: Arc<WebSocketManager>,
    /// GPU Compute for graph calculations protected by a read-write lock.
    pub gpu_compute: Arc<RwLock<GPUCompute>>, 
}

impl AppState {
    /// Creates a new `AppState` instance.
    pub fn new(
        graph_data: Arc<RwLock<GraphData>>,
        file_cache: Arc<RwLock<HashMap<String, String>>>,
        settings: Settings,
        github_service: Arc<dyn GitHubService + Send + Sync>,
        perplexity_service: PerplexityServiceImpl, // Concrete type
        websocket_manager: Arc<WebSocketManager>,
        gpu_compute: Arc<RwLock<GPUCompute>>,
    ) -> Self {
        Self {
            graph_data,
            file_cache,
            settings,
            github_service,
            perplexity_service, // Assign the concrete type
            websocket_manager,
            gpu_compute,
        }
    }
}