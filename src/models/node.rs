// node.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a node in the graph.
#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Node {
    /// Unique identifier for the node.
    pub id: String,
    /// Display label for the node.
    pub label: String,
    /// Additional metadata associated with the node.
    pub metadata: HashMap<String, String>,
    /// Position coordinates for visualisation.
    pub x: f32,
    pub y: f32,
    pub z: f32,
    /// Velocity for simulation purposes.
    #[serde(skip)]
    pub vx: f32,
    #[serde(skip)]
    pub vy: f32,
    #[serde(skip)]
    pub vz: f32,
}
