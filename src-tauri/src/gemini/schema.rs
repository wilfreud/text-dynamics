use serde_json::{json, Value};

use crate::analysis::model::{MovementKind, PhaseKind};

/// Builds the authoritative Gemini JSON Schema for structured analysis responses.
///
/// Ensures exact alignment with CanonicalAnalysis Rust types and enum definitions.
pub fn analysis_response_schema() -> Value {
    json!({
        "type": "OBJECT",
        "description": "Structured dynamic analysis of literary text",
        "properties": {
            "schema_version": {
                "type": "STRING",
                "description": "Schema version, must be '1.0'"
            },
            "segments": {
                "type": "ARRAY",
                "description": "Ordered semantic segments grouping contiguous source units",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "id": {
                            "type": "STRING",
                            "description": "Segment ID formatted as s001, s002, etc."
                        },
                        "start_unit_id": {
                            "type": "STRING",
                            "description": "Starting source unit ID (e.g., u0001)"
                        },
                        "end_unit_id": {
                            "type": "STRING",
                            "description": "Ending source unit ID (e.g., u0002)"
                        },
                        "intensity": {
                            "type": "NUMBER",
                            "description": "Perceived force/impact from 0.0 to 10.0"
                        },
                        "tension": {
                            "type": "NUMBER",
                            "description": "Pressure, suspense, unease from 0.0 to 10.0"
                        },
                        "valence": {
                            "type": "NUMBER",
                            "description": "Negative/dark (-10.0) to positive/light (+10.0)"
                        },
                        "temperature": {
                            "type": "NUMBER",
                            "description": "Cold/detached (-10.0) to hot/visceral (+10.0)"
                        },
                        "confidence": {
                            "type": "NUMBER",
                            "description": "Model confidence from 0.0 to 1.0"
                        },
                        "rationale": {
                            "type": "STRING",
                            "description": "Concise justification for the interpretation"
                        }
                    },
                    "required": [
                        "id",
                        "start_unit_id",
                        "end_unit_id",
                        "intensity",
                        "tension",
                        "valence",
                        "temperature",
                        "confidence"
                    ]
                }
            },
            "movements": {
                "type": "ARRAY",
                "description": "Dynamic movements spanning one or more segments",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "id": {
                            "type": "STRING",
                            "description": "Movement ID formatted as m001, m002, etc."
                        },
                        "start_segment_id": {
                            "type": "STRING",
                            "description": "Starting segment ID"
                        },
                        "end_segment_id": {
                            "type": "STRING",
                            "description": "Ending segment ID"
                        },
                        "kind": {
                            "type": "STRING",
                            "enum": MovementKind::all_variants(),
                            "description": "Movement kind"
                        },
                        "magnitude": {
                            "type": "NUMBER",
                            "description": "Movement amplitude/intensity from 0.0 to 10.0"
                        },
                        "confidence": {
                            "type": "NUMBER",
                            "description": "Confidence from 0.0 to 1.0"
                        },
                        "rationale": {
                            "type": "STRING",
                            "description": "Concise movement rationale"
                        }
                    },
                    "required": [
                        "id",
                        "start_segment_id",
                        "end_segment_id",
                        "kind",
                        "magnitude",
                        "confidence"
                    ]
                }
            },
            "phases": {
                "type": "ARRAY",
                "description": "Broad structural phases across segments",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "id": {
                            "type": "STRING",
                            "description": "Phase ID formatted as p001, p002, etc."
                        },
                        "start_segment_id": {
                            "type": "STRING",
                            "description": "Starting segment ID"
                        },
                        "end_segment_id": {
                            "type": "STRING",
                            "description": "Ending segment ID"
                        },
                        "kind": {
                            "type": "STRING",
                            "enum": PhaseKind::all_variants(),
                            "description": "Phase structural category"
                        },
                        "label": {
                            "type": "STRING",
                            "description": "Short human-readable label"
                        },
                        "confidence": {
                            "type": "NUMBER",
                            "description": "Confidence from 0.0 to 1.0"
                        }
                    },
                    "required": [
                        "id",
                        "start_segment_id",
                        "end_segment_id",
                        "kind",
                        "label",
                        "confidence"
                    ]
                }
            },
            "overall": {
                "type": "OBJECT",
                "description": "Holistic summary of structural dynamics",
                "properties": {
                    "summary": {
                        "type": "STRING",
                        "description": "Brief structural reading of the entire text"
                    },
                    "dominant_shape": {
                        "type": "STRING",
                        "description": "Short description of the dominant structural contour"
                    }
                },
                "required": ["summary", "dominant_shape"]
            }
        },
        "required": [
            "schema_version",
            "segments",
            "movements",
            "phases",
            "overall"
        ]
    })
}
