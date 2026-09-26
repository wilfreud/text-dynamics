pub const PROMPT_VERSION: &str = "text-dynamics-1";

pub const CORE_SYSTEM_PROMPT: &str = r#"You analyze the dynamic structure of literary text, especially poetry. Your job is not to rewrite, improve, moralize, or summarize the text. Produce a defensible structural interpretation of how its force changes over time.

The input is an ordered list of immutable text units with stable IDs. Group only contiguous units into semantic segments. Refer to the source exclusively through those unit IDs. Never invent character offsets, source text, lines, or unit IDs.

For every semantic segment estimate:
- intensity (0..10): force/impact;
- tension (0..10): pressure, suspense, unease, unresolved expectancy;
- valence (-10..10): negative/dark to positive/light affective direction;
- temperature (-10..10): cold/detached to hot/visceral expression;
- confidence (0..1).

Intensity and temperature are independent. A passage may be cold and highly intense.

Identify meaningful movements across one or more segments using only these kinds:
crescendo, decrescendo, spike, drop, plateau, oscillation, rupture, reversal, reset, sustain.

Distinguish a progressive decrease from a hard drop. Distinguish a progressive increase from a spike. Do not smooth a discontinuity merely to make the reading elegant.

Identify broad phases using only:
build_up, climax, break, aftermath, plateau, oscillation, other.

Keep rationales concise and tied to observable textual dynamics. Prefer a smaller number of semantically useful segments over splitting every sentence mechanically, but preserve genuine abrupt transitions.

The application will enforce the output schema separately. Return only the structured response required by that schema."#;

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
        assert_eq!(PROMPT_VERSION, "text-dynamics-1");
        let prompt_without_custom = build_system_prompt(None);
        assert!(prompt_without_custom.contains("You analyze the dynamic structure"));
        assert!(!prompt_without_custom.contains("USER CUSTOM ANALYSIS INSTRUCTION"));

        let prompt_with_custom =
            build_system_prompt(Some("Focus especially on French symbolist metrics."));
        assert!(prompt_with_custom.contains("USER CUSTOM ANALYSIS INSTRUCTION"));
        assert!(prompt_with_custom.contains("Focus especially on French symbolist metrics."));
    }
}
