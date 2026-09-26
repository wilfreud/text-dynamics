use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SourceUnit {
    pub id: String,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MovementKind {
    Crescendo,
    Decrescendo,
    Spike,
    Drop,
    Plateau,
    Oscillation,
    Rupture,
    Reversal,
    Reset,
    Sustain,
}

impl MovementKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Crescendo => "crescendo",
            Self::Decrescendo => "decrescendo",
            Self::Spike => "spike",
            Self::Drop => "drop",
            Self::Plateau => "plateau",
            Self::Oscillation => "oscillation",
            Self::Rupture => "rupture",
            Self::Reversal => "reversal",
            Self::Reset => "reset",
            Self::Sustain => "sustain",
        }
    }

    pub fn all_variants() -> &'static [&'static str] {
        &[
            "crescendo",
            "decrescendo",
            "spike",
            "drop",
            "plateau",
            "oscillation",
            "rupture",
            "reversal",
            "reset",
            "sustain",
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PhaseKind {
    BuildUp,
    Climax,
    Break,
    Aftermath,
    Plateau,
    Oscillation,
    Other,
}

impl PhaseKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BuildUp => "build_up",
            Self::Climax => "climax",
            Self::Break => "break",
            Self::Aftermath => "aftermath",
            Self::Plateau => "plateau",
            Self::Oscillation => "oscillation",
            Self::Other => "other",
        }
    }

    pub fn all_variants() -> &'static [&'static str] {
        &[
            "build_up",
            "climax",
            "break",
            "aftermath",
            "plateau",
            "oscillation",
            "other",
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisSegment {
    pub id: String,
    pub start_unit_id: String,
    pub end_unit_id: String,
    pub intensity: f64,
    pub tension: f64,
    pub valence: f64,
    pub temperature: f64,
    pub confidence: f64,
    #[serde(default)]
    pub rationale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisMovement {
    pub id: String,
    pub start_segment_id: String,
    pub end_segment_id: String,
    pub kind: MovementKind,
    pub magnitude: f64,
    pub confidence: f64,
    #[serde(default)]
    pub rationale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisPhase {
    pub id: String,
    pub start_segment_id: String,
    pub end_segment_id: String,
    pub kind: PhaseKind,
    pub label: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisOverall {
    pub summary: String,
    pub dominant_shape: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CanonicalAnalysis {
    pub schema_version: String,
    pub segments: Vec<AnalysisSegment>,
    pub movements: Vec<AnalysisMovement>,
    pub phases: Vec<AnalysisPhase>,
    pub overall: AnalysisOverall,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct SegmentOverride {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intensity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tension: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub valence: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct MovementOverride {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<MovementKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SegmentGroup {
    pub id: String,
    pub label: String,
    pub segment_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct UserOverrides {
    #[serde(default)]
    pub segment_overrides: HashMap<String, SegmentOverride>,
    #[serde(default)]
    pub movement_overrides: HashMap<String, MovementOverride>,
    #[serde(default)]
    pub groups: Vec<SegmentGroup>,
}
