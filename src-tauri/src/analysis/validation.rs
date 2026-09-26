use std::collections::{HashMap, HashSet};

use crate::analysis::model::{CanonicalAnalysis, SourceUnit};
use crate::error::AppError;

pub const SUPPORTED_SCHEMA_VERSION: &str = "1.0";

/// Validates a CanonicalAnalysis against the provided source units.
///
/// Invariants enforced:
/// 1. schema_version is supported ("1.0").
/// 2. At least one segment is present if source units exist.
/// 3. Segment IDs are unique.
/// 4. Unit IDs referenced by segments exist in the source unit list.
/// 5. Segment unit ranges are forward, ordered, and non-overlapping in source order.
/// 6. All segment metrics fall within their allowed numeric ranges and are finite.
/// 7. Movement references to segments exist and are forward in sequence.
/// 8. Phase references to segments exist and are forward in sequence.
/// 9. Movement and phase IDs are unique.
pub fn validate_canonical_analysis(
    analysis: &CanonicalAnalysis,
    source_units: &[SourceUnit],
) -> Result<(), AppError> {
    // 1. Schema version
    if analysis.schema_version != SUPPORTED_SCHEMA_VERSION {
        return Err(AppError::Analysis(format!(
            "Unsupported schema version: '{}' (expected '{}')",
            analysis.schema_version, SUPPORTED_SCHEMA_VERSION
        )));
    }

    // Map source units to their sequential indices for O(1) order and existence checks
    let unit_index_map: HashMap<&str, usize> = source_units
        .iter()
        .enumerate()
        .map(|(idx, u)| (u.id.as_str(), idx))
        .collect();

    // 2. Validate segments
    if analysis.segments.is_empty() && !source_units.is_empty() {
        return Err(AppError::Analysis(
            "Analysis must contain at least one segment for non-empty text".to_string(),
        ));
    }

    let mut seen_segment_ids = HashSet::new();
    let mut segment_index_map: HashMap<&str, usize> = HashMap::new();
    let mut last_unit_end_idx: Option<usize> = None;

    for (seg_idx, seg) in analysis.segments.iter().enumerate() {
        // Unique segment ID
        if !seen_segment_ids.insert(&seg.id) {
            return Err(AppError::Analysis(format!(
                "Duplicate segment ID: '{}'",
                seg.id
            )));
        }
        segment_index_map.insert(&seg.id, seg_idx);

        // Referenced unit IDs exist
        let start_u_idx = unit_index_map
            .get(seg.start_unit_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Segment '{}' references unknown start_unit_id '{}'",
                    seg.id, seg.start_unit_id
                ))
            })?;

        let end_u_idx = unit_index_map
            .get(seg.end_unit_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Segment '{}' references unknown end_unit_id '{}'",
                    seg.id, seg.end_unit_id
                ))
            })?;

        // Range order within segment
        if start_u_idx > end_u_idx {
            return Err(AppError::Analysis(format!(
                "Segment '{}' has start_unit_id '{}' (idx {}) after end_unit_id '{}' (idx {})",
                seg.id, seg.start_unit_id, start_u_idx, seg.end_unit_id, end_u_idx
            )));
        }

        // Forward non-overlapping sequence across segments
        if let Some(last_end) = last_unit_end_idx {
            if start_u_idx <= last_end {
                return Err(AppError::Analysis(format!(
                    "Segment '{}' overlaps with previous segment (start idx {} <= previous end idx {})",
                    seg.id, start_u_idx, last_end
                )));
            }
        }
        last_unit_end_idx = Some(end_u_idx);

        // Numeric metric validations
        validate_range("intensity", seg.intensity, 0.0, 10.0, &seg.id)?;
        validate_range("tension", seg.tension, 0.0, 10.0, &seg.id)?;
        validate_range("valence", seg.valence, -10.0, 10.0, &seg.id)?;
        validate_range("temperature", seg.temperature, -10.0, 10.0, &seg.id)?;
        validate_range("confidence", seg.confidence, 0.0, 1.0, &seg.id)?;
    }

    // 3. Validate movements
    let mut seen_movement_ids = HashSet::new();
    for mov in &analysis.movements {
        if !seen_movement_ids.insert(&mov.id) {
            return Err(AppError::Analysis(format!(
                "Duplicate movement ID: '{}'",
                mov.id
            )));
        }

        let start_seg_idx = segment_index_map
            .get(mov.start_segment_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Movement '{}' references unknown start_segment_id '{}'",
                    mov.id, mov.start_segment_id
                ))
            })?;

        let end_seg_idx = segment_index_map
            .get(mov.end_segment_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Movement '{}' references unknown end_segment_id '{}'",
                    mov.id, mov.end_segment_id
                ))
            })?;

        if start_seg_idx > end_seg_idx {
            return Err(AppError::Analysis(format!(
                "Movement '{}' has inverted segment order: start '{}' after end '{}'",
                mov.id, mov.start_segment_id, mov.end_segment_id
            )));
        }

        validate_range("magnitude", mov.magnitude, 0.0, 10.0, &mov.id)?;
        validate_range("confidence", mov.confidence, 0.0, 1.0, &mov.id)?;
    }

    // 4. Validate phases
    let mut seen_phase_ids = HashSet::new();
    for phase in &analysis.phases {
        if !seen_phase_ids.insert(&phase.id) {
            return Err(AppError::Analysis(format!(
                "Duplicate phase ID: '{}'",
                phase.id
            )));
        }

        let start_seg_idx = segment_index_map
            .get(phase.start_segment_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Phase '{}' references unknown start_segment_id '{}'",
                    phase.id, phase.start_segment_id
                ))
            })?;

        let end_seg_idx = segment_index_map
            .get(phase.end_segment_id.as_str())
            .copied()
            .ok_or_else(|| {
                AppError::Analysis(format!(
                    "Phase '{}' references unknown end_segment_id '{}'",
                    phase.id, phase.end_segment_id
                ))
            })?;

        if start_seg_idx > end_seg_idx {
            return Err(AppError::Analysis(format!(
                "Phase '{}' has inverted segment order: start '{}' after end '{}'",
                phase.id, phase.start_segment_id, phase.end_segment_id
            )));
        }

        validate_range("confidence", phase.confidence, 0.0, 1.0, &phase.id)?;
    }

    Ok(())
}

fn validate_range(
    metric: &str,
    val: f64,
    min: f64,
    max: f64,
    entity_id: &str,
) -> Result<(), AppError> {
    if val.is_nan() || val.is_infinite() {
        return Err(AppError::Analysis(format!(
            "Metric '{metric}' for '{entity_id}' is non-finite: {val}"
        )));
    }
    if val < min || val > max {
        return Err(AppError::Analysis(format!(
            "Metric '{metric}' for '{entity_id}' out of range: {val} (allowed {min}..={max})"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::model::{
        AnalysisMovement, AnalysisOverall, AnalysisPhase, AnalysisSegment, MovementKind, PhaseKind,
    };

    fn sample_units() -> Vec<SourceUnit> {
        vec![
            SourceUnit {
                id: "u0001".into(),
                text: "Line 1".into(),
            },
            SourceUnit {
                id: "u0002".into(),
                text: "Line 2".into(),
            },
            SourceUnit {
                id: "u0003".into(),
                text: "Line 3".into(),
            },
        ]
    }

    fn valid_analysis() -> CanonicalAnalysis {
        CanonicalAnalysis {
            schema_version: "1.0".into(),
            segments: vec![
                AnalysisSegment {
                    id: "s001".into(),
                    start_unit_id: "u0001".into(),
                    end_unit_id: "u0002".into(),
                    intensity: 7.0,
                    tension: 5.0,
                    valence: -2.0,
                    temperature: 1.0,
                    confidence: 0.9,
                    rationale: Some("Build up".into()),
                },
                AnalysisSegment {
                    id: "s002".into(),
                    start_unit_id: "u0003".into(),
                    end_unit_id: "u0003".into(),
                    intensity: 9.5,
                    tension: 8.0,
                    valence: -5.0,
                    temperature: 4.0,
                    confidence: 0.85,
                    rationale: Some("Climax".into()),
                },
            ],
            movements: vec![AnalysisMovement {
                id: "m001".into(),
                start_segment_id: "s001".into(),
                end_segment_id: "s002".into(),
                kind: MovementKind::Crescendo,
                magnitude: 8.0,
                confidence: 0.9,
                rationale: None,
            }],
            phases: vec![AnalysisPhase {
                id: "p001".into(),
                start_segment_id: "s001".into(),
                end_segment_id: "s002".into(),
                kind: PhaseKind::BuildUp,
                label: "Rising Action".into(),
                confidence: 0.88,
            }],
            overall: AnalysisOverall {
                summary: "Dramatic progression".into(),
                dominant_shape: "Crescendo to climax".into(),
            },
        }
    }

    #[test]
    fn test_valid_analysis_passes() {
        let units = sample_units();
        let analysis = valid_analysis();
        assert!(validate_canonical_analysis(&analysis, &units).is_ok());
    }

    #[test]
    fn test_invalid_schema_version_rejected() {
        let units = sample_units();
        let mut analysis = valid_analysis();
        analysis.schema_version = "2.0".into();
        assert!(validate_canonical_analysis(&analysis, &units).is_err());
    }

    #[test]
    fn test_overlapping_segments_rejected() {
        let units = sample_units();
        let mut analysis = valid_analysis();
        // s002 starts at u0002 which was already in s001 (u0001..=u0002)
        analysis.segments[1].start_unit_id = "u0002".into();
        assert!(validate_canonical_analysis(&analysis, &units).is_err());
    }

    #[test]
    fn test_unknown_unit_id_rejected() {
        let units = sample_units();
        let mut analysis = valid_analysis();
        analysis.segments[0].start_unit_id = "u9999".into();
        assert!(validate_canonical_analysis(&analysis, &units).is_err());
    }

    #[test]
    fn test_out_of_range_metric_rejected() {
        let units = sample_units();
        let mut analysis = valid_analysis();
        analysis.segments[0].intensity = 11.0;
        assert!(validate_canonical_analysis(&analysis, &units).is_err());
    }
}
