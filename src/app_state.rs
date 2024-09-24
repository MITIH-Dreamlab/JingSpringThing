// app_state.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::models::graph::GraphData;
use crate::config::Settings;
use crate::services::file_service::GitHubService;
use crate::utils::websocket_manager::WebSocketManager;

/// Holds the shared application state accessible across different parts of the application.
pub struct AppState {
    /// Shared graph data.
    pub graph_data: Arc<RwLock<GraphData>>,
    /// Cache for file contents.
    pub file_cache: Arc<RwLock<HashMap<String, String>>>,
    /// Application settings.
    pub settings: Settings,
    /// GitHub service for interacting with GitHub API.
    pub github_service: Arc<dyn GitHubService + Send + Sync>,
    /// WebSocket manager for handling WebSocket connections.
    pub websocket_manager: Arc<WebSocketManager>,
}

impl AppState {
    /// Creates a new `AppState` instance.
    ///
    /// # Arguments
    ///
    /// * `graph_data` - Shared graph data.
    /// * `file_cache` - Cache for file contents.
    /// * `settings` - Application settings.
    /// * `github_service` - GitHub service instance.
    /// * `websocket_manager` - WebSocket manager instance.
    ///
    /// # Returns
    ///
    /// A new `AppState` instance.
    pub fn new(
        graph_data: Arc<RwLock<GraphData>>,
        file_cache: Arc<RwLock<HashMap<String, String>>>,
        settings: Settings,
        github_service: Arc<dyn GitHubService + Send + Sync>,
        websocket_manager: Arc<WebSocketManager>,
    ) -> Self {
        Self { graph_data, file_cache, settings, github_service, websocket_manager }
    }
}
