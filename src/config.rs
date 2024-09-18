use serde::Deserialize;
use config::{Config, ConfigError, File};
use dotenv::dotenv;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub prompt: String,
    pub topics: Vec<String>,
    pub perplexity: PerplexityConfig,
}

#[derive(Debug, Deserialize)]
pub struct PerplexityConfig {
    pub api_key: String,
    pub model: String,
    pub api_base_url: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub top_p: f32,
    pub presence_penalty: f32,
    pub frequency_penalty: f32,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        dotenv().ok();

        let mut builder = Config::builder();

        let base_settings_path = Path::new("settings.toml");
        if base_settings_path.exists() {
            builder = builder.add_source(File::from(base_settings_path).required(false));
        }

        if cfg!(test) {
            let test_settings_path = Path::new("tests").join("settings.test.toml");
            if test_settings_path.exists() {
                builder = builder.add_source(File::from(test_settings_path).required(false));
            }
        }

        builder = builder.add_source(config::Environment::with_prefix("APP").separator("__"));

        let config = builder.build()?;
        config.try_deserialize()
    }
}