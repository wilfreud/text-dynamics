use crate::analysis::model::SourceUnit;

const MAX_UNIT_LEN: usize = 500;

/// Formats a zero-based unit index into a stable unit ID (e.g. u0001).
pub fn format_unit_id(index: usize) -> String {
    format!("u{:04}", index + 1)
}

fn split_long_chunk(text: &str, max_len: usize, units: &mut Vec<SourceUnit>) {
    let mut current = text;
    while current.len() > max_len {
        let mut target_end = max_len;
        while target_end > 0 && !current.is_char_boundary(target_end) {
            target_end -= 1;
        }
        if target_end == 0 {
            target_end = current
                .char_indices()
                .nth(1)
                .map(|(i, _)| i)
                .unwrap_or(current.len());
        }

        let mut target_start = (max_len as f64 * 0.4) as usize;
        while target_start < target_end && !current.is_char_boundary(target_start) {
            target_start += 1;
        }
        if target_start >= target_end {
            target_start = 0;
        }

        let window = &current[target_start..target_end];

        let split_pos = if let Some(pos) = window.rfind([';', ':', ',']) {
            target_start + pos + 1
        } else if let Some(pos) = window.rfind(' ') {
            target_start + pos
        } else {
            target_end
        };

        let chunk = current[..split_pos].trim();
        if !chunk.is_empty() {
            units.push(SourceUnit {
                id: format_unit_id(units.len()),
                text: chunk.to_string(),
            });
        }
        current = current[split_pos..].trim_start();
    }

    let remainder = current.trim();
    if !remainder.is_empty() {
        units.push(SourceUnit {
            id: format_unit_id(units.len()),
            text: remainder.to_string(),
        });
    }
}

/// Converts plain source text into deterministic atomic units while preserving
/// physical line breaks for poetry and splitting multiple sentences on a line.
pub fn unitize_text(source: &str) -> Vec<SourceUnit> {
    let mut units = Vec::new();

    for line in source.lines() {
        let trimmed_line = line.trim();
        if trimmed_line.is_empty() {
            continue;
        }

        let char_indices: Vec<(usize, char)> = trimmed_line.char_indices().collect();
        let num_chars = char_indices.len();
        let mut start_byte = 0;
        let mut ci = 0;

        while ci < num_chars {
            let (_, ch) = char_indices[ci];
            let is_term = ch == '.' || ch == '!' || ch == '?';
            let is_ellipsis = ch == '.'
                && ci + 2 < num_chars
                && char_indices[ci + 1].1 == '.'
                && char_indices[ci + 2].1 == '.';

            if is_term || is_ellipsis {
                let term_end_ci = if is_ellipsis { ci + 3 } else { ci + 1 };
                let term_end_byte = if term_end_ci < num_chars {
                    char_indices[term_end_ci].0
                } else {
                    trimmed_line.len()
                };

                let followed_by_space_or_end =
                    term_end_ci >= num_chars || char_indices[term_end_ci].1.is_whitespace();

                if followed_by_space_or_end {
                    let sentence = trimmed_line[start_byte..term_end_byte].trim();
                    if !sentence.is_empty() {
                        if sentence.len() > MAX_UNIT_LEN {
                            split_long_chunk(sentence, MAX_UNIT_LEN, &mut units);
                        } else {
                            units.push(SourceUnit {
                                id: format_unit_id(units.len()),
                                text: sentence.to_string(),
                            });
                        }
                    }

                    let mut next_ci = term_end_ci;
                    while next_ci < num_chars && char_indices[next_ci].1.is_whitespace() {
                        next_ci += 1;
                    }
                    start_byte = if next_ci < num_chars {
                        char_indices[next_ci].0
                    } else {
                        trimmed_line.len()
                    };
                    ci = next_ci;
                    continue;
                }
            }
            ci += 1;
        }

        if start_byte < trimmed_line.len() {
            let tail = trimmed_line[start_byte..].trim();
            if !tail.is_empty() {
                if tail.len() > MAX_UNIT_LEN {
                    split_long_chunk(tail, MAX_UNIT_LEN, &mut units);
                } else {
                    units.push(SourceUnit {
                        id: format_unit_id(units.len()),
                        text: tail.to_string(),
                    });
                }
            }
        }
    }

    units
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unitize_multi_line_poetry() {
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

    #[test]
    fn test_unitize_single_line_multiple_sentences() {
        let text = "Il est tard. Je devrais partir. Pourtant je reste.";
        let units = unitize_text(text);
        assert_eq!(units.len(), 3);
        assert_eq!(units[0].id, "u0001");
        assert_eq!(units[0].text, "Il est tard.");
        assert_eq!(units[1].id, "u0002");
        assert_eq!(units[1].text, "Je devrais partir.");
        assert_eq!(units[2].id, "u0003");
        assert_eq!(units[2].text, "Pourtant je reste.");
    }

    #[test]
    fn test_unitize_long_chunk_fallback() {
        let sentence = "Un long flux sans point mais avec des virgules, répété plusieurs fois, ";
        let long_text = sentence.repeat(10);
        let units = unitize_text(&long_text);
        assert!(units.len() > 1);
        for u in &units {
            assert!(u.text.len() <= MAX_UNIT_LEN);
        }
    }
}
