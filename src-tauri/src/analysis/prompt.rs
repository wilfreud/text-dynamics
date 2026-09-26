pub const PROMPT_VERSION: &str = "text-dynamics-2";

pub const CORE_SYSTEM_PROMPT: &str = r#"You are analyzing the dynamic structure of a literary text.

The input has already been split into ordered atomic source units.
Each unit has a stable ID such as u0001. Paragraph/stanza boundaries are explicitly indicated when present.

Your job is NOT to perform sentence segmentation.
Your job is to group contiguous atomic units into semantic dynamic segments.

A semantic segment is a contiguous region of the text that maintains a broadly coherent emotional/rhetorical dynamic state.

Create a segment boundary when there is a meaningful change in one or more of:
- intensity
- tension
- valence
- temperature
- rhetorical register
- pacing
- emotional stance
- focus
- irony
- escalation
- release
- rupture
- aftermath

Paragraph/stanza boundaries are strong structural evidence but are not mandatory segment boundaries.
Do not mechanically create one segment per paragraph, sentence, or line.
Do not collapse a long text into one or two segments if it contains several distinct internal movements.
Do not over-segment stable passages.

Segments must:
- use only supplied unit IDs;
- preserve source order;
- be contiguous;
- never overlap;
- collectively cover every supplied unit exactly once.

For every segment, score:
- INTENSITY: 0..10 (Perceived force, impact, acoustic weight, visceral energy, rhetorical force, or experiential magnitude)
- TENSION: 0..10 (Psychological suspense, pressure, unresolved expectancy, conflict, constriction, or accumulating unease)
- VALENCE: -10..+10 (Affective direction from dark/negative to bright/positive)
- TEMPERATURE: -10..+10 (Affective register from detached/cold to passionate/warm/hot)
- CONFIDENCE: 0..1

Do not conflate these dimensions:
- high tension can be quiet (low intensity);
- high intensity can be cathartic (tension release);
- negative valence can be warm/hot (rage, passionate grief) or cold (detached despair);
- positive valence can be cold (serene distance) or warm (elation, affection).

Identify meaningful movements across adjacent segments using only:
crescendo, decrescendo, spike, drop, plateau, oscillation, rupture, reversal, reset, sustain.

Identify broad phases using only:
build_up, climax, break, aftermath, plateau, oscillation, other.

Give each segment a concise label and concise rationale.
Return only the structured response required by the supplied schema."#;

/// Assembles the complete system prompt, cleanly appending optional user custom instructions.
pub fn build_system_prompt(custom_instruction: Option<&str>) -> String {
    let mut prompt = CORE_SYSTEM_PROMPT.to_string();

    if let Some(custom) = custom_instruction {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            prompt.push_str("\n\n---\n\nUSER CUSTOM ANALYSIS INSTRUCTION:\n");
            prompt.push_str(trimmed);
            prompt.push_str("\n\n(Notice: User custom instructions tune analytical nuances but must never override schema structure or unit-ID integrity rules.)");
        }
    }

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_version_and_content() {
        assert_eq!(PROMPT_VERSION, "text-dynamics-2");
        let prompt_without_custom = build_system_prompt(None);
        assert!(prompt_without_custom.contains("semantic dynamic segments"));
        assert!(!prompt_without_custom.contains("USER CUSTOM ANALYSIS INSTRUCTION"));

        let prompt_with_custom =
            build_system_prompt(Some("Focus especially on French symbolist metrics."));
        assert!(prompt_with_custom.contains("USER CUSTOM ANALYSIS INSTRUCTION"));
        assert!(prompt_with_custom.contains("Focus especially on French symbolist metrics."));
    }
}
