// src/services/ragflow_service.rs

use serde::{Deserialize, Serialize};
use reqwest::{Client, StatusCode};
use log::{debug, error};
use crate::config::Settings;
use std::fmt;

#[derive(Debug)]
pub enum RAGFlowError {
    ReqwestError(reqwest::Error),
    StatusError(StatusCode, String),
}

impl fmt::Display for RAGFlowError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RAGFlowError::ReqwestError(e) => write!(f, "Reqwest error: {}", e),
            RAGFlowError::StatusError(status, msg) => write!(f, "Status error ({}): {}", status, msg),
        }
    }
}

impl std::error::Error for RAGFlowError {}

impl From<reqwest::Error> for RAGFlowError {
    fn from(err: reqwest::Error) -> Self {
        RAGFlowError::ReqwestError(err)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub conversation_id: Option<String>,
    pub message: String,
    pub content: String,
}

pub struct RAGFlowService {
    client: Client,
    api_key: String,
    base_url: String,
}

impl RAGFlowService {
    pub fn new(settings: &Settings) -> Self {
        Self {
            client: Client::new(),
            api_key: settings.ragflow.ragflow_api_key.clone(),
            base_url: settings.ragflow.ragflow_api_base_url.clone(),
        }
    }

    pub async fn create_conversation(&self, user_id: String) -> Result<String, RAGFlowError> {
        debug!("Creating conversation for user: {}", user_id);
        let url = format!("{}api/new_conversation", self.base_url);
        let response = self.client.get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .query(&[("user_id", user_id)])
            .send()
            .await?;

        if response.status().is_success() {
            let result: serde_json::Value = response.json().await?;
            Ok(result["data"]["id"].as_str().unwrap_or("").to_string())
        } else {
            let status = response.status();
            let error_message = response.text().await?;
            error!("Failed to create conversation. Status: {}, Error: {}", status, error_message);
            Err(RAGFlowError::StatusError(status, error_message))
        }
    }

    pub async fn send_message(&self, conversation_id: String, message: String) -> Result<ChatResponse, RAGFlowError> {
        debug!("Sending message to conversation: {}", conversation_id);
        let url = format!("{}api/completion", self.base_url);
        let response = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "conversation_id": conversation_id,
                "messages": [{"role": "user", "content": message}],
                "stream": false
            }))
            .send()
            .await?;

        if response.status().is_success() {
            let result: ChatResponse = response.json().await?;
            Ok(result)
        } else {
            let status = response.status();
            let error_message = response.text().await?;
            error!("Failed to send message. Status: {}, Error: {}", status, error_message);
            Err(RAGFlowError::StatusError(status, error_message))
        }
    }

    pub async fn get_chat_history(conversation_id: String) -> Result<Vec<Message>, reqwest::Error> {
        // Placeholder implementation
        Ok(vec![Message {
            conversation_id: Some(conversation_id.clone()),
            message: String::new(), // Empty string as a placeholder
            content: format!("Chat history for conversation: {}", conversation_id)
        }])
    }
}
