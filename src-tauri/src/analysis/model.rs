use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSegment {
    pub id: String,
    pub start_unit_id: String,
    pub end_unit_id: String,
    pub intensity: f64,
    pub tension: f64,
    pub valence: f64,
    pub temperature: f64,
    pub confidence: f64,
    pub rationale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisMovement {
    pub id: String,
    pub start_segment_id: String,
    pub end_segment_id: String,
    pub kind: String,
    pub magnitude: f64,
    pub confidence: f64,
    pub rationale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisPhase {
    pub id: String,
    pub start_segment_id: String,
    pub end_segment_id: String,
    pub kind: String,
    pub label: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisOverall {
    pub summary: String,
    pub dominant_shape: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalAnalysis {
    pub schema_version: String,
    pub segments: Vec<AnalysisSegment>,
    pub movements: Vec<AnalysisMovement>,
    pub phases: Vec<AnalysisPhase>,
    pub overall: AnalysisOverall,
}
