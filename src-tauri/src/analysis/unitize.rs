use crate::analysis::model::SourceUnit;

/// Formats a zero-based unit index into a stable unit ID (e.g. u0001).
pub fn format_unit_id(index: usize) -> String {
    format!("u{:04}", index + 1)
}

/// Converts plain source text into deterministic line units.
pub fn unitize_text(source: &str) -> Vec<SourceUnit> {
    source
        .lines()
        .map(|line| line.trim())
        .filter(|trimmed| !trimmed.is_empty())
        .enumerate()
        .map(|(idx, text)| SourceUnit {
            id: format_unit_id(idx),
            text: text.to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unitize_text() {
        let text = "Line 1\n\n  Line 2  \r\nLine 3\n";
        let units = unitize_text(text);
        assert_eq!(units.len(), 3);
        assert_eq!(units[0].id, "u0001");
        assert_eq!(units[0].text, "Line 1");
        assert_eq!(units[1].id, "u0002");
        assert_eq!(units[1].text, "Line 2");
        assert_eq!(units[2].id, "u0003");
        assert_eq!(units[2].text, "Line 3");
    }
}
