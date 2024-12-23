use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Stores metadata about a processed file.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Metadata {
    pub file_name: String,
    pub file_size: usize,
    pub node_size: f64,  // Added field for scaled node size
    pub hyperlink_count: usize,
    pub sha1: String,
    pub perplexity_link: String,
    pub last_perplexity_process: Option<DateTime<Utc>>,
    pub last_modified: DateTime<Utc>,
    pub topic_counts: HashMap<String, usize>,
}
