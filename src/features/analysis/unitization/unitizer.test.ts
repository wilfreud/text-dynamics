import { describe, it } from "node:test";
import assert from "node:assert";
import {
  unitizeText,
  formatModelPayload,
  resolveSegmentOffsets,
} from "./unitizer";

describe("unitizer — deterministic atomic unit segmentation", () => {
  it("segments a single sentence into one atomic unit", () => {
    const text = "Le silence s'installe lentement.";
    const result = unitizeText(text);

    assert.strictEqual(result.units.length, 1);
    assert.strictEqual(result.units[0].id, "u0001");
    assert.strictEqual(result.units[0].text, "Le silence s'installe lentement.");
    assert.strictEqual(result.paragraphs.length, 1);
    assert.strictEqual(result.paragraphs[0].id, "p001");
    assert.strictEqual(
      text.slice(result.units[0].startIndex, result.units[0].endIndex),
      result.units[0].text
    );
  });

  it("segments several sentences on a single line into several atomic units", () => {
    const text = "Il est tard. Je devrais partir. Pourtant je reste.";
    const result = unitizeText(text);

    assert.strictEqual(result.units.length, 3);
    assert.strictEqual(result.units[0].id, "u0001");
    assert.strictEqual(result.units[0].text, "Il est tard.");
    assert.strictEqual(result.units[1].id, "u0002");
    assert.strictEqual(result.units[1].text, "Je devrais partir.");
    assert.strictEqual(result.units[2].id, "u0003");
    assert.strictEqual(result.units[2].text, "Pourtant je reste.");

    // All belong to the same single paragraph
    assert.strictEqual(result.paragraphs.length, 1);
    assert.strictEqual(result.units[0].paragraphId, "p001");
    assert.strictEqual(result.units[1].paragraphId, "p001");
    assert.strictEqual(result.units[2].paragraphId, "p001");

    // Exact UTF-16 offsets
    for (const unit of result.units) {
      assert.strictEqual(text.slice(unit.startIndex, unit.endIndex), unit.text);
    }
  });

  it("segments a giant one-paragraph prose paste into many atomic units", () => {
    const text =
      "Il est encore une heure. Ce n’est pas la première fois que je me dis que ce sera la dernière. " +
      "Une dernière valse dans le noir. Je fuis le sommeil. Je préfère contempler le vide. " +
      "Je devrais peut-être fuir. C’est une solution comme une autre. Je serai seul mais ce sera enfin justifié.";

    const result = unitizeText(text);

    assert.strictEqual(result.paragraphs.length, 1);
    assert.ok(result.units.length >= 7);

    // Verify ordering and contiguity
    for (let i = 0; i < result.units.length; i++) {
      const u = result.units[i];
      assert.strictEqual(u.index, i);
      assert.strictEqual(text.slice(u.startIndex, u.endIndex), u.text);
      if (i > 0) {
        assert.ok(u.startIndex >= result.units[i - 1].endIndex);
      }
    }
  });

  it("preserves paragraph/stanza boundaries across multiple paragraphs", () => {
    const text = "Premier paragraphe avec du texte.\n\nDeuxième paragraphe avec d'autres phrases.";
    const result = unitizeText(text);

    assert.strictEqual(result.paragraphs.length, 2);
    assert.strictEqual(result.paragraphs[0].id, "p001");
    assert.strictEqual(result.paragraphs[1].id, "p002");

    assert.strictEqual(result.units[0].paragraphId, "p001");
    assert.strictEqual(result.units[1].paragraphId, "p002");
  });

  it("preserves physical line units for poetry without punctuation", () => {
    const text = "je marche\nencore\nencore\n\npuis plus rien";
    const result = unitizeText(text);

    assert.strictEqual(result.paragraphs.length, 2);
    assert.strictEqual(result.units.length, 4);

    assert.strictEqual(result.units[0].text, "je marche");
    assert.strictEqual(result.units[0].kind, "poetic-line");
    assert.strictEqual(result.units[0].paragraphId, "p001");

    assert.strictEqual(result.units[1].text, "encore");
    assert.strictEqual(result.units[1].paragraphId, "p001");

    assert.strictEqual(result.units[2].text, "encore");
    assert.strictEqual(result.units[2].paragraphId, "p001");

    assert.strictEqual(result.units[3].text, "puis plus rien");
    assert.strictEqual(result.units[3].paragraphId, "p002");

    for (const unit of result.units) {
      assert.strictEqual(text.slice(unit.startIndex, unit.endIndex), unit.text);
    }
  });

  it("correctly calculates offsets with smart French punctuation and Unicode", () => {
    const text = "« Tu viens ? » Non. Peut-être… Je ne sais pas — pas encore. Cœur brisé 🙂.";
    const result = unitizeText(text);

    assert.ok(result.units.length > 1);
    for (const unit of result.units) {
      assert.strictEqual(text.slice(unit.startIndex, unit.endIndex), unit.text);
    }
  });

  it("handles CRLF line endings without corrupting UTF-16 offsets", () => {
    const text = "Ligne une.\r\nLigne deux.\r\n\r\nLigne trois après saut.";
    const result = unitizeText(text);

    assert.strictEqual(result.paragraphs.length, 2);
    assert.strictEqual(result.units.length, 3);

    for (const unit of result.units) {
      assert.strictEqual(text.slice(unit.startIndex, unit.endIndex), unit.text);
    }
  });

  it("ignores whitespace-only lines without producing meaningless units", () => {
    const text = "   \n\n   Première ligne.   \n    \n   Deuxième ligne.   \n\n  ";
    const result = unitizeText(text);

    assert.strictEqual(result.units.length, 2);
    assert.strictEqual(result.units[0].text, "Première ligne.");
    assert.strictEqual(result.units[1].text, "Deuxième ligne.");

    assert.strictEqual(text.slice(result.units[0].startIndex, result.units[0].endIndex), "Première ligne.");
    assert.strictEqual(text.slice(result.units[1].startIndex, result.units[1].endIndex), "Deuxième ligne.");
  });

  it("splits extremely long unpunctuated lines using safety fallback", () => {
    // Generate a long line with clause punctuation and words > 1000 chars
    const sentence = "un long flux de mots sans point final mais avec des virgules, répété plusieurs fois pour dépasser le seuil de sécurité, ";
    const longText = sentence.repeat(10); // ~1300 chars

    const result = unitizeText(longText);

    assert.ok(result.units.length > 1);
    for (const unit of result.units) {
      assert.ok(unit.text.length <= 500);
      assert.strictEqual(longText.slice(unit.startIndex, unit.endIndex), unit.text);
      assert.ok(unit.kind === "clause-fallback" || unit.kind === "length-fallback");
    }
  });

  it("formats model payload with explicit paragraph and unit markers", () => {
    const text = "Première phrase.\n\nDeuxième phrase.";
    const result = unitizeText(text);
    const payload = formatModelPayload(result);

    assert.ok(payload.includes("[P001]"));
    assert.ok(payload.includes("[u0001] Première phrase."));
    assert.ok(payload.includes("[/P001]"));
    assert.ok(payload.includes("[P002]"));
    assert.ok(payload.includes("[u0002] Deuxième phrase."));
    assert.ok(payload.includes("[/P002]"));
  });

  it("resolves multi-unit segment offsets accurately", () => {
    const text = "Phrase une. Phrase deux. Phrase trois.";
    const result = unitizeText(text);

    const offsets = resolveSegmentOffsets(
      { startUnitId: "u0001", endUnitId: "u0002" },
      result.units
    );

    assert.ok(offsets !== null);
    assert.strictEqual(offsets!.startOffset, result.units[0].startIndex);
    assert.strictEqual(offsets!.endOffset, result.units[1].endIndex);
    assert.strictEqual(
      text.slice(offsets!.startOffset, offsets!.endOffset),
      "Phrase une. Phrase deux."
    );
  });
});
