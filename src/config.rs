// config.rs

use serde::Deserialize;
use config::{Config, ConfigError, File, Environment};
use dotenv::dotenv;
use std::path::Path;
use std::fs::File as StdFile;
use std::io::{BufRead, BufReader};
use log::{info, error};

/// Represents the application settings loaded from configuration files and environment variables.
#[derive(Debug, Deserialize)]
pub struct Settings {
    /// The prompt used for AI interactions.
    pub prompt: String,
    /// A list of topics loaded from a CSV file.
    #[serde(skip)]
    pub topics: Vec<String>,
    /// Configuration settings for Perplexity AI integration.
    pub perplexity: PerplexityConfig,
    /// Configuration settings for RAGFlow integration.
    pub ragflow: RAGFlowConfig,
    /// Configuration settings for GitHub integration.
    pub github: GitHubConfig,
    /// Default configuration settings.
    pub default: DefaultConfig,
}

/// Configuration for Perplexity AI API integration.
#[derive(Debug, Deserialize)]
pub struct PerplexityConfig {
    /// API key for authenticating with Perplexity AI.
    pub api_key: String,
    /// Model name to be used with Perplexity AI.
    pub model: String,
    /// Base URL for Perplexity AI API.
    pub api_base_url: String,
    /// Maximum number of tokens for responses.
    pub max_tokens: u32,
    /// Sampling temperature for response generation.
    pub temperature: f32,
    /// Top-p sampling parameter.
    pub top_p: f32,
    /// Penalty for presence of new tokens.
    pub presence_penalty: f32,
    /// Penalty for frequency of existing tokens.
    pub frequency_penalty: f32,
}

/// Configuration for RAGFlow integration.
#[derive(Debug, Deserialize)]
pub struct RAGFlowConfig {
    /// API key for authenticating with RAGFlow.
    pub api_key: String,
    /// Base URL for RAGFlow API.
    pub api_base_url: String,
}

/// Configuration for GitHub API integration.
#[derive(Debug, Deserialize)]
pub struct GitHubConfig {
    /// Personal Access Token for GitHub API.
    pub access_token: String,
    /// GitHub repository owner.
    pub owner: String,
    /// GitHub repository name.
    pub repo: String,
    /// Directory within the repository to fetch files from.
    pub directory: String,
}

/// Default configuration settings.
#[derive(Debug, Deserialize)]
pub struct DefaultConfig {
    /// Maximum number of concurrent API requests.
    pub max_concurrent_requests: u32,
    /// Maximum number of retries for failed API requests.
    pub max_retries: u32,
    /// Delay between retries in seconds.
    pub retry_delay: u64,
    /// Timeout for API client in seconds.
    pub api_client_timeout: u64,
}

impl Settings {
    /// Creates a new `Settings` instance by loading configuration from files and environment variables.
    pub fn new() -> Result<Self, ConfigError> {
        // Load environment variables from .env file.
        dotenv().ok();

        info!("Current working directory: {:?}", std::env::current_dir());

        let mut builder = Config::builder();

        // Load default settings from settings.toml in the current directory.
        let base_settings_path = Path::new("settings.toml");
        if base_settings_path.exists() {
            info!("Loading default settings from {:?}", base_settings_path);
            builder = builder.add_source(File::from(base_settings_path).required(true));
        } else {
            error!("Default settings file not found at {:?}", base_settings_path);
            return Err(ConfigError::NotFound("settings.toml".into()));
        }

        // Load environment variables, overriding settings from files.
        builder = builder.add_source(Environment::default().separator("__"));
        info!("Loading environment variables");

        let config_map = builder.build()?;
        info!("Raw configuration: {:#?}", config_map);

        // Deserialize into Settings struct.
        let mut settings: Settings = config_map.try_deserialize()?;

        // Load topics from CSV file using a relative path.
        settings.topics = Self::load_topics_from_csv("data/topics.csv")?;
        info!("Loaded topics: {:?}", settings.topics);

        info!("Final parsed configuration: {:#?}", settings);

        Ok(settings)
    }

    /// Loads topics from a CSV file.
    fn load_topics_from_csv(file_path: &str) -> Result<Vec<String>, ConfigError> {
        let file = StdFile::open(file_path).map_err(|e| {
            error!("Failed to open topics.csv: {}", e);
            ConfigError::Message(format!(
                "Failed to open topics.csv: {}. Make sure the file exists in the 'data' directory.",
                e
            ))
        })?;

        let reader = BufReader::new(file);
        let topics: Vec<String> = reader
            .lines()
            .filter_map(Result::ok)
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect();

        if topics.is_empty() {
            error!("No topics found in topics.csv");
            Err(ConfigError::Message(
                "No topics found in topics.csv".to_string(),
            ))
        } else {
            Ok(topics)
        }
    }
}
