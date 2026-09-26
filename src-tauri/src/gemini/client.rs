use reqwest::Client;

#[allow(dead_code)]
pub struct GeminiClient {
    client: Client,
}

impl GeminiClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

impl Default for GeminiClient {
    fn default() -> Self {
        Self::new()
    }
}
