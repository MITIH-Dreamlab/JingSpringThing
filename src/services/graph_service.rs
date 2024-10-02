// src/services/graph_service.rs

use crate::AppState;
use crate::models::graph::GraphData;
use crate::models::node::Node;
use crate::models::edge::Edge;
use crate::models::metadata::Metadata;
use crate::utils::gpu_compute::GPUCompute;
use log::{info, warn, debug};
use std::collections::{HashMap, HashSet};
use tokio::fs;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde_json;

/// Service responsible for building and managing the graph data structure.
pub struct GraphService;

impl GraphService {
    /// Builds the graph data structure from processed Markdown files.
    /// 
    /// This function performs the following steps:
    /// 1. Reads the metadata JSON file.
    /// 2. Creates nodes for each file in the metadata.
    /// 3. Analyzes content for connections between nodes.
    /// 4. Constructs edges based on both interconnectedness and hyperlinks.
    /// 5. Uses GPUCompute to calculate force-directed layout if available, otherwise falls back to CPU.
    /// 6. Returns the complete `GraphData` structure.
    ///
    /// # Arguments
    ///
    /// * `app_state` - Shared application state containing settings and file cache.
    ///
    /// # Returns
    ///
    /// A `Result` containing the `GraphData` on success or an error on failure.
    pub async fn build_graph(app_state: &AppState) -> Result<GraphData, Box<dyn std::error::Error + Send + Sync>> {
        info!("Building graph data from metadata");
        let metadata_path = "/app/data/markdown/metadata.json";
        let metadata_content = fs::read_to_string(metadata_path).await?;
        let metadata: HashMap<String, Metadata> = serde_json::from_str(&metadata_content)?;
    
        let mut graph = GraphData::default();
        let mut edge_map: HashMap<(String, String), (f32, u32)> = HashMap::new();
    
        // Create nodes
        for (file_name, _) in &metadata {
            let node_id = file_name.trim_end_matches(".md").to_string();
            graph.nodes.push(Node {
                id: node_id.clone(),
                label: node_id.clone(),
                metadata: HashMap::new(), // Initialize with an empty HashMap
                x: 0.0, y: 0.0, z: 0.0,
                vx: 0.0, vy: 0.0, vz: 0.0,
            });
        }
    
        // Build edges
        for (file_name, file_metadata) in &metadata {
            let node_id = file_name.trim_end_matches(".md").to_string();
            for (other_file, _) in &metadata {
                if file_name != other_file {
                    let other_node_id = other_file.trim_end_matches(".md");
                    let count = file_metadata.topic_counts.get(other_node_id).cloned().unwrap_or(0) as f32;
                    if count > 0.0 {
                        let edge_key = if node_id < other_node_id.to_string() {
                            (node_id.clone(), other_node_id.to_string())
                        } else {
                            (other_node_id.to_string(), node_id.clone())
                        };
                        edge_map.entry(edge_key)
                            .and_modify(|(weight, hyperlinks)| {
                                *weight += count;
                                *hyperlinks += file_metadata.hyperlink_count as u32;
                            })
                            .or_insert((count, file_metadata.hyperlink_count as u32));
                    }
                }
            }
        }
    
        // Convert edge_map to edges
        graph.edges = edge_map.into_iter().map(|((source, target), (weight, hyperlinks))| {
            Edge {
                source,
                target_node: target,
                weight,
                hyperlinks: hyperlinks as f32,
            }
        }).collect();
        
        info!("Graph data built with {} nodes and {} edges", graph.nodes.len(), graph.edges.len());
        debug!("Sample node data: {:?}", graph.nodes.first());
        debug!("Sample edge data: {:?}", graph.edges.first());

        // Calculate layout using GPU if available, otherwise fall back to CPU
        Self::calculate_layout(&app_state.gpu_compute, &mut graph).await?;
        
        debug!("Final sample node data after layout calculation: {:?}", graph.nodes.first());
        
        Ok(graph)
    }

    /// Calculates the force-directed layout using GPUCompute if available, otherwise falls back to CPU.
    ///
    /// # Arguments
    ///
    /// * `gpu_compute` - Optional reference to the GPUCompute instance.
    /// * `graph` - Mutable reference to the GraphData to be updated.
    ///
    /// # Returns
    ///
    /// A `Result` indicating success or failure.
    async fn calculate_layout(gpu_compute: &Option<Arc<RwLock<GPUCompute>>>, graph: &mut GraphData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match gpu_compute {
            Some(gpu) => {
                info!("Using GPU for layout calculation");
                // GPU-based calculation
                let mut gpu_compute = gpu.write().await; // Acquire write lock
                gpu_compute.set_graph_data(graph)?;
                gpu_compute.compute_forces()?;
                let updated_nodes = gpu_compute.get_updated_positions().await?;

                // Update graph nodes with new positions
                for (i, node) in graph.nodes.iter_mut().enumerate() {
                    node.x = updated_nodes[i].x;
                    node.y = updated_nodes[i].y;
                    node.z = updated_nodes[i].z;
                    node.vx = updated_nodes[i].vx;
                    node.vy = updated_nodes[i].vy;
                    node.vz = updated_nodes[i].vz;
                }
                debug!("GPU layout calculation complete. Sample updated node: {:?}", graph.nodes.first());
            },
            None => {
                warn!("GPU not available. Falling back to CPU-based layout calculation.");
                Self::calculate_layout_cpu(graph);
                debug!("CPU layout calculation complete. Sample updated node: {:?}", graph.nodes.first());
            }
        }

        Ok(())
    }

    /// Calculates the force-directed layout using CPU.
    ///
    /// This function implements a simple force-directed layout algorithm on the CPU.
    /// It's used as a fallback when GPU computation is not available.
    ///
    /// # Arguments
    ///
    /// * `graph` - Mutable reference to the GraphData to be updated.
    fn calculate_layout_cpu(graph: &mut GraphData) {
        const ITERATIONS: usize = 100;
        const REPULSION: f32 = 1.0;
        const ATTRACTION: f32 = 0.01;

        for _ in 0..ITERATIONS {
            // Calculate repulsive forces
            for i in 0..graph.nodes.len() {
                for j in (i + 1)..graph.nodes.len() {
                    let dx = graph.nodes[j].x - graph.nodes[i].x;
                    let dy = graph.nodes[j].y - graph.nodes[i].y;
                    let dz = graph.nodes[j].z - graph.nodes[i].z;
                    let distance = (dx * dx + dy * dy + dz * dz).sqrt().max(0.1);
                    let force = REPULSION / (distance * distance);
                    let fx = force * dx / distance;
                    let fy = force * dy / distance;
                    let fz = force * dz / distance;

                    graph.nodes[i].vx -= fx;
                    graph.nodes[i].vy -= fy;
                    graph.nodes[i].vz -= fz;
                    graph.nodes[j].vx += fx;
                    graph.nodes[j].vy += fy;
                    graph.nodes[j].vz += fz;
                }
            }

            // Calculate attractive forces
            for edge in &graph.edges {
                let source = graph.nodes.iter().position(|n| n.id == edge.source).unwrap();
                let target = graph.nodes.iter().position(|n| n.id == edge.target_node).unwrap();
                let dx = graph.nodes[target].x - graph.nodes[source].x;
                let dy = graph.nodes[target].y - graph.nodes[source].y;
                let dz = graph.nodes[target].z - graph.nodes[source].z;
                let distance = (dx * dx + dy * dy + dz * dz).sqrt().max(0.1);
                let force = ATTRACTION * distance * edge.weight;
                let fx = force * dx / distance;
                let fy = force * dy / distance;
                let fz = force * dz / distance;

                graph.nodes[source].vx += fx;
                graph.nodes[source].vy += fy;
                graph.nodes[source].vz += fz;
                graph.nodes[target].vx -= fx;
                graph.nodes[target].vy -= fy;
                graph.nodes[target].vz -= fz;
            }

            // Update positions
            for node in &mut graph.nodes {
                node.x += node.vx;
                node.y += node.vy;
                node.z += node.vz;
                node.vx *= 0.9; // Damping
                node.vy *= 0.9;
                node.vz *= 0.9;
            }
        }
    }

    /// Finds the shortest path between two nodes in the graph.
    ///
    /// This function implements Dijkstra's algorithm to find the shortest path
    /// between a start node and an end node in the graph.
    ///
    /// # Arguments
    ///
    /// * `graph` - Reference to the GraphData.
    /// * `start` - ID of the start node.
    /// * `end` - ID of the end node.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of node IDs representing the shortest path,
    /// or an error if no path is found.
    pub fn find_shortest_path(graph: &GraphData, start: &str, end: &str) -> Result<Vec<String>, String> {
        let mut distances: HashMap<String, f32> = HashMap::new();
        let mut previous: HashMap<String, Option<String>> = HashMap::new();
        let mut unvisited: HashSet<String> = HashSet::new();
    
        for node in &graph.nodes {
            distances.insert(node.id.clone(), f32::INFINITY);
            previous.insert(node.id.clone(), None);
            unvisited.insert(node.id.clone());
        }
        distances.insert(start.to_string(), 0.0);
    
        while !unvisited.is_empty() {
            let current = unvisited.iter()
                .min_by(|a, b| distances[*a].partial_cmp(&distances[*b]).unwrap())
                .cloned()
                .unwrap();
    
            if current == end {
                break;
            }
    
            unvisited.remove(&current);
    
            for edge in &graph.edges {
                if edge.source == current || edge.target_node == current {
                    let neighbor = if edge.source == current { &edge.target_node } else { &edge.source };
                    if unvisited.contains(neighbor) {
                        let alt = distances[&current] + edge.weight;
                        if alt < distances[neighbor] {
                            distances.insert(neighbor.to_string(), alt);
                            previous.insert(neighbor.to_string(), Some(current.to_string()));
                        }
                    }
                }
            }
        }
    
        // Reconstruct path
        let mut path = Vec::new();
        let mut current = end.to_string();
        while let Some(prev) = previous[&current].clone() {
            path.push(current.clone());
            current = prev;
            if current == start {
                path.push(start.to_string());
                path.reverse();
                return Ok(path);
            }
        }
    
        Err("No path found".to_string())
    }
}    
