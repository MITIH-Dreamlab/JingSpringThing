use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use actix::prelude::*;
use crate::AppState;
use log::{info, error, debug};
use std::sync::{Mutex, Arc};
use serde_json::{json, Value};
use futures::future::join_all;
use crate::handlers::ragflow_handler::MessageRequest;
use crate::services::ragflow_service::{RAGFlowService, ChatResponseData};

pub struct WebSocketManager {
    pub sessions: Mutex<Vec<Addr<WebSocketSession>>>,
    pub conversation_id: Arc<Mutex<Option<String>>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        WebSocketManager {
            sessions: Mutex::new(Vec::new()),
            conversation_id: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn initialize(&self, ragflow_service: &RAGFlowService) -> Result<(), Box<dyn std::error::Error>> {
        let conversation_id = ragflow_service.create_conversation("default_user".to_string()).await?;
        *self.conversation_id.lock().unwrap() = Some(conversation_id.clone());
        info!("Initialized conversation with ID: {}", conversation_id);
        Ok(())
    }

    pub async fn handle_websocket(req: HttpRequest, stream: web::Payload, state: web::Data<AppState>) -> Result<HttpResponse, Error> {
        info!("New WebSocket connection request");
        let session = WebSocketSession::new(state.clone());
        let resp = ws::start(session, &req, stream)?;
        info!("WebSocket connection established");
        Ok(resp)
    }

    pub async fn broadcast_message(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let sessions = self.sessions.lock().unwrap().clone();
        let futures = sessions.iter().map(|session| {
            session.send(BroadcastMessage(message.to_string()))
        });
        
        join_all(futures).await;
        debug!("Broadcasted message to {} sessions", sessions.len());
        Ok(())
    }
}

pub struct WebSocketSession {
    state: web::Data<AppState>,
}

impl WebSocketSession {
    fn new(state: web::Data<AppState>) -> Self {
        WebSocketSession { state }
    }

    fn send_json_response(&self, ctx: &mut ws::WebsocketContext<Self>, data: Value) {
        if let Ok(json_string) = serde_json::to_string(&data) {
            ctx.text(json_string.clone());
            debug!("Sent JSON response: {}", json_string);
        } else {
            error!("Failed to serialize JSON response");
        }
    }

    fn handle_chat_message(&self, ctx: &mut ws::WebsocketContext<Self>, msg: Value) {
        info!("Handling chat message: {:?}", msg);
        match msg["type"].as_str() {
            Some("ragflowQuery") => self.handle_ragflow_query(ctx, msg),
            Some("chatHistory") => self.handle_chat_history(ctx, msg),
            _ => {
                error!("Unknown chat message type");
                self.send_json_response(ctx, json!({
                    "type": "error",
                    "message": "Unknown chat message type"
                }));
            }
        }
    }

    fn handle_ragflow_query(&self, ctx: &mut ws::WebsocketContext<Self>, msg: Value) {
        info!("Handling RAGflow query: {:?}", msg);
        let state = self.state.clone();
        let conversation_id = state.websocket_manager.conversation_id.lock().unwrap().clone();
        
        ctx.spawn(async move {
            match conversation_id {
                Some(conv_id) => {
                    let message = msg["message"].as_str().unwrap_or("").to_string();
                    let quote = msg["quote"].as_bool().unwrap_or(false);
                    let doc_ids = msg["docIds"].as_array().map(|arr| {
                        arr.iter().filter_map(|v| v.as_str()).map(String::from).collect::<Vec<String>>()
                    });
                    let stream = msg["stream"].as_bool().unwrap_or(false);

                    let msg_request = MessageRequest { 
                        conversation_id: conv_id.clone(),
                        messages: vec![crate::services::ragflow_service::Message {
                            role: "user".to_string(),
                            content: message.clone(),
                        }],
                        quote: Some(quote),
                        doc_ids: doc_ids.clone(),
                        stream: Some(stream),
                    };
                    match state.ragflow_service.send_message(conv_id, message, quote, doc_ids, stream).await {
                        Ok(response) => {
                            info!("RAGflow query successful: {:?}", response);
                            let message = match response.data {
                                ChatResponseData::MessageArray { message } => message,
                                ChatResponseData::SingleMessage { message } => vec![message],
                                ChatResponseData::Empty {} => vec![],
                            };
                            json!({
                                "type": "ragflowResponse",
                                "data": {
                                    "message": message
                                }
                            })
                        },
                        Err(e) => {
                            error!("Failed to send message: {:?}", e);
                            json!({
                                "type": "error",
                                "message": format!("Failed to send message: {}", e)
                            })
                        },
                    }
                },
                None => {
                    error!("Chat not initialized");
                    json!({
                        "type": "error",
                        "message": "Chat not initialized. Please try again later."
                    })
                },
            }
        }.into_actor(self).map(|response, act, ctx| {
            act.send_json_response(ctx, response);
        }));
    }

    fn handle_chat_history(&self, ctx: &mut ws::WebsocketContext<Self>, msg: Value) {
        info!("Handling chat history request: {:?}", msg);
        let state = self.state.clone();
        let conversation_id = state.websocket_manager.conversation_id.lock().unwrap().clone();
        ctx.spawn(async move {
            match conversation_id {
                Some(conv_id) => {
                    match state.ragflow_service.get_chat_history(conv_id).await {
                        Ok(history) => {
                            info!("Chat history retrieved successfully");
                            json!({
                                "type": "chatHistoryResponse",
                                "data": history.data
                            })
                        },
                        Err(e) => {
                            error!("Failed to fetch chat history: {:?}", e);
                            json!({
                                "type": "error",
                                "message": format!("Failed to fetch chat history: {}", e)
                            })
                        },
                    }
                },
                None => {
                    error!("Chat not initialized");
                    json!({
                        "type": "error",
                        "message": "Chat not initialized. Please try again later."
                    })
                },
            }
        }.into_actor(self).map(|response, act, ctx| {
            act.send_json_response(ctx, response);
        }));
    }

    fn handle_graph_update(&self, ctx: &mut ws::WebsocketContext<Self>) {
        let state = self.state.clone();
        ctx.spawn(async move {
            let graph_data = state.graph_data.read().await;
            let nodes_with_file_size: Vec<_> = graph_data.nodes.iter().map(|node| {
                let mut node_with_metadata = node.clone();
                if let Some(metadata) = graph_data.metadata.get(&node.id) {
                    node_with_metadata.metadata.insert("file_size".to_string(), metadata.file_size.to_string());
                }
                node_with_metadata
            }).collect();
            json!({
                "type": "graphUpdate",
                "graphData": {
                    "nodes": nodes_with_file_size,
                    "edges": graph_data.edges,
                }
            })
        }.into_actor(self).map(|response, act, ctx| {
            act.send_json_response(ctx, response);
        }));
    }
}

impl Actor for WebSocketSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let addr = ctx.address();
        self.state.websocket_manager.sessions.lock().unwrap().push(addr);
        info!("WebSocket session started. Total sessions: {}", self.state.websocket_manager.sessions.lock().unwrap().len());
    }

    fn stopped(&mut self, ctx: &mut Self::Context) {
        let addr = ctx.address();
        self.state.websocket_manager.sessions.lock().unwrap().retain(|session| session != &addr);
        info!("WebSocket session stopped. Total sessions: {}", self.state.websocket_manager.sessions.lock().unwrap().len());
    }
}

#[derive(Message)]
#[rtype(result = "()")]
struct BroadcastMessage(String);

impl Handler<BroadcastMessage> for WebSocketSession {
    type Result = ();

    fn handle(&mut self, msg: BroadcastMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
        debug!("Broadcasted message to client");
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                ctx.pong(&msg);
            },
            Ok(ws::Message::Pong(_)) => {
                // Optionally handle pong responses.
            },
            Ok(ws::Message::Text(text)) => {
                info!("Received message from client: {}", text);
                match serde_json::from_str::<Value>(&text) {
                    Ok(json_data) => {
                        if let Some(msg_type) = json_data["type"].as_str() {
                            match msg_type {
                                "getInitialData" => {
                                    debug!("Handling getInitialData request");
                                    self.handle_graph_update(ctx);
                                },
                                "ragflowQuery" | "chatHistory" => {
                                    debug!("Handling chat message: {}", msg_type);
                                    self.handle_chat_message(ctx, json_data);
                                },
                                _ => {
                                    error!("Received unknown message type: {}", msg_type);
                                    let error_response = json!({
                                        "type": "error",
                                        "message": format!("Unknown message type: {}", msg_type),
                                    });
                                    self.send_json_response(ctx, error_response);
                                }
                            }
                        } else {
                            error!("Received message without a type field");
                            let error_response = json!({
                                "type": "error",
                                "message": "Message type not specified",
                            });
                            self.send_json_response(ctx, error_response);
                        }
                    },
                    Err(e) => {
                        error!("Failed to parse incoming message as JSON: {}", e);
                        let error_response = json!({
                            "type": "error",
                            "message": "Invalid JSON format",
                        });
                        self.send_json_response(ctx, error_response);
                    }
                }
            },
            Ok(ws::Message::Binary(bin)) => {
                let bin_clone = bin.clone();
                ctx.binary(bin);
                debug!("Received binary message of {} bytes", bin_clone.len());
            },
            Ok(ws::Message::Close(reason)) => {
                info!("WebSocket closed: {:?}", reason);
                ctx.stop();
            },
            _ => (),
        }
    }
}
