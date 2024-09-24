// edge.rs

use serde::{Serialize, Deserialize};

/// Represents an edge connecting two nodes in the graph.
#[derive(Clone, Serialize, Deserialize)]
pub struct Edge {
    /// ID of the source node.
    pub source: String,
    /// ID of the target node.
    pub target: String,
    /// Weight of the edge.
    pub weight: f32,
}

impl Edge {
    /// Creates a new `Edge` instance.
    ///
    /// # Arguments
    ///
    /// * `source` - ID of the source node.
    /// * `target` - ID of the target node.
    /// * `weight` - Weight of the edge.
    ///
    /// # Returns
    ///
    /// A new `Edge` instance.
    pub fn new(source: String, target: String, weight: f32) -> Self {
        Edge { source, target, weight }
    }
}
