use actix_web::{web, HttpResponse};
use crate::AppState;
use serde::{Serialize};
use crate::services::ragflow_service::{RAGFlowService, Message};
use log::{info, error};

/// Response structure for sending messages.
#[derive(Serialize)]
pub struct SendMessageResponse {
    /// Status of the message sending operation.
    pub status: String,
    /// Response from the RAGFlow service.
    pub response: String,
}

/// Response structure for initiating a chat.
#[derive(Serialize)]
pub struct InitChatResponse {
    /// Status of the chat initiation.
    pub status: String,
    /// ID of the newly created conversation.
    pub conversation_id: String,
}

/// Response structure for retrieving chat history.
#[derive(Serialize)]
pub struct ChatHistoryResponse {
    /// Status of the chat history retrieval.
    pub status: String,
    /// List of messages in the conversation.
    pub history: Vec<Message>,
}

/// Handler for sending a message to the RAGFlow service.
///
/// This function performs the following steps:
/// 1. Extracts the conversation ID and message content from the request.
/// 2. Sends the message to the RAGFlow service.
/// 3. Returns the response from the RAGFlow service.
///
/// # Arguments
///
/// * `state` - Shared application state.
/// * `msg` - JSON payload containing the message.
///
/// # Returns
///
/// An HTTP response containing the RAGFlow service's response or an error.
pub async fn send_message(_state: web::Data<AppState>, msg: web::Json<Message>) -> HttpResponse {
    let conversation_id = msg.0.conversation_id.clone().unwrap_or_else(|| "default".to_string());
    let message_content = msg.0.message.clone();

    info!("Sending message to RAGFlow: {}", message_content);

    match RAGFlowService::send_message(conversation_id.clone(), message_content).await {
        Ok(response) => HttpResponse::Ok().json(SendMessageResponse {
            status: "success".to_string(),
            response,
        }),
        Err(e) => {
            error!("Error sending message: {}", e);
            HttpResponse::InternalServerError().json(SendMessageResponse {
                status: "error".to_string(),
                response: "Failed to send message".to_string(),
            })
        }
    }
}

/// Handler for initiating a new chat conversation.
///
/// This function performs the following steps:
/// 1. Receives a user ID to associate with the new conversation.
/// 2. Creates a new conversation using the RAGFlow service.
/// 3. Returns the new conversation ID.
///
/// # Arguments
///
/// * `state` - Shared application state.
/// * `user_id` - JSON payload containing the user ID.
///
/// # Returns
///
/// An HTTP response containing the new conversation ID or an error.
pub async fn init_chat(_state: web::Data<AppState>, user_id: web::Json<String>) -> HttpResponse {
    let user_id = user_id.into_inner();

    info!("Initializing chat for user: {}", user_id);

    match RAGFlowService::create_conversation(user_id).await {
        Ok(conversation_id) => HttpResponse::Ok().json(InitChatResponse {
            status: "success".to_string(),
            conversation_id,
        }),
        Err(e) => {
            error!("Error initiating chat: {}", e);
            HttpResponse::InternalServerError().json(InitChatResponse {
                status: "error".to_string(),
                conversation_id: "".to_string(),
            })
        }
    }
}

/// Handler for retrieving chat history.
///
/// This function performs the following steps:
/// 1. Extracts the conversation ID from the URL path.
/// 2. Retrieves the chat history from the RAGFlow service.
/// 3. Returns the chat history.
///
/// # Arguments
///
/// * `state` - Shared application state.
/// * `path` - URL path parameters containing the conversation ID.
///
/// # Returns
///
/// An HTTP response containing the chat history or an error.
pub async fn get_chat_history(_state: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let conversation_id = path.into_inner();

    info!("Retrieving chat history for conversation: {}", conversation_id);

    match RAGFlowService::get_chat_history(conversation_id).await {
        Ok(history) => HttpResponse::Ok().json(ChatHistoryResponse {
            status: "success".to_string(),
            history,
        }),
        Err(e) => {
            error!("Error retrieving chat history: {}", e);
            HttpResponse::InternalServerError().json(ChatHistoryResponse {
                status: "error".to_string(),
                history: Vec::new(),
            })
        }
    }
}
