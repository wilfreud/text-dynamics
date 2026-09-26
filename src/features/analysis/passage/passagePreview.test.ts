import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createPassagePreview,
  getSegmentSourcePassage,
} from "./passagePreview";
import type { SourceUnit } from "../unitization/unitizer";

describe("passagePreview — Exact Source Extraction & Deterministic Previews", () => {
  const sampleUnits: SourceUnit[] = [
    {
      id: "u0001",
      index: 0,
      text: "Je me demande, dans un accès de lucidité,",
      lineIndex: 0,
      stanzaIndex: 0,
      paragraphId: "p001",
      lineId: "l0001",
      kind: "sentence",
      startIndex: 0,
      endIndex: 41,
    },
    {
      id: "u0002",
      index: 1,
      text: "si ma chambre a toujours été aussi pleine;",
      lineIndex: 1,
      stanzaIndex: 0,
      paragraphId: "p001",
      lineId: "l0002",
      kind: "sentence",
      startIndex: 42,
      endIndex: 84,
    },
    {
      id: "u0003",
      index: 2,
      text: "pleine de souvenirs auxquels je ne cesse de m'accrocher,",
      lineIndex: 2,
      stanzaIndex: 0,
      paragraphId: "p001",
      lineId: "l0003",
      kind: "sentence",
      startIndex: 85,
      endIndex: 141,
    },
    {
      id: "u0004",
      index: 3,
      text: "pleine de babioles inutiles, pleine de chaussures qui ne me vont plus.",
      lineIndex: 3,
      stanzaIndex: 0,
      paragraphId: "p001",
      lineId: "l0004",
      kind: "sentence",
      startIndex: 142,
      endIndex: 212,
    },
  ];

  const fullSourceText =
    "Je me demande, dans un accès de lucidité,\nsi ma chambre a toujours été aussi pleine;\npleine de souvenirs auxquels je ne cesse de m'accrocher,\npleine de babioles inutiles, pleine de chaussures qui ne me vont plus.";

  it("extracts exact source passage from units slice without modification", () => {
    const segment = { startUnitId: "u0001", endUnitId: "u0002" };
    const resolved = getSegmentSourcePassage(fullSourceText, segment, sampleUnits);

    assert.ok(resolved !== null);
    assert.strictEqual(resolved.isValid, true);
    assert.strictEqual(resolved.startOffset, 0);
    assert.strictEqual(resolved.endOffset, 84);
    // Invariant: exact local slice
    assert.strictEqual(
      resolved.passage,
      fullSourceText.slice(0, 84)
    );
    assert.strictEqual(resolved.unitRangeLabel, "u0001–u0002");
  });

  it("handles single-unit segment exact range and label", () => {
    const segment = { startUnitId: "u0002", endUnitId: "u0002" };
    const resolved = getSegmentSourcePassage(fullSourceText, segment, sampleUnits);

    assert.ok(resolved !== null);
    assert.strictEqual(resolved.isValid, true);
    assert.strictEqual(resolved.startOffset, 42);
    assert.strictEqual(resolved.endOffset, 84);
    assert.strictEqual(resolved.passage, fullSourceText.slice(42, 84));
    assert.strictEqual(resolved.unitRangeLabel, "u0002");
  });

  it("defensively rejects out-of-bounds or inverted offsets without crashing", () => {
    const badUnits: SourceUnit[] = [
      {
        ...sampleUnits[0],
        startIndex: 500, // Beyond source length
        endIndex: 600,
      },
      {
        ...sampleUnits[1],
        startIndex: 600,
        endIndex: 550, // Inverted!
      },
    ];

    const resolved = getSegmentSourcePassage(
      fullSourceText,
      { startUnitId: "u0001", endUnitId: "u0002" },
      badUnits
    );

    assert.ok(resolved !== null);
    assert.strictEqual(resolved.isValid, false);
    assert.strictEqual(resolved.passage, "");
  });

  it("renders short passages in full without ellipses", () => {
    const shortText = "Non.";
    const preview = createPassagePreview(shortText);

    assert.strictEqual(preview.kind, "full");
    assert.strictEqual(preview.text, "Non.");
    assert.strictEqual(preview.head, undefined);
    assert.strictEqual(preview.tail, undefined);
  });

  it("renders long passage with head and tail preserving both ends", () => {
    const longPassage =
      "Je me demande, dans un accès de lucidité, si ma chambre a toujours été aussi pleine; pleine de souvenirs auxquels je ne cesse de m'accrocher, pleine de babioles inutiles, pleine de chaussures qui ne me vont plus.";

    const preview = createPassagePreview(longPassage, {
      fullThreshold: 100,
      headTarget: 50,
      tailTarget: 40,
    });

    assert.strictEqual(preview.kind, "head-tail");
    assert.ok(preview.head !== undefined);
    assert.ok(preview.tail !== undefined);
    // Head starts with the beginning of the passage
    assert.ok(preview.head.startsWith("Je me demande"));
    // Tail ends with the ending of the passage
    assert.ok(preview.tail.endsWith("ne me vont plus."));
    // Middle is omitted
    assert.ok((preview.omittedCharacterCount ?? 0) > 0);
  });

  it("preserves line breaks in poetry without flattening", () => {
    const poem = "je marche\nencore\nencore\n\npuis plus rien";
    const preview = createPassagePreview(poem, { fullThreshold: 200 });

    assert.strictEqual(preview.kind, "full");
    assert.strictEqual(preview.text, poem);
    assert.ok(preview.text.includes("\nencore\n"));
    assert.ok(preview.text.includes("\n\n"));
  });

  it("handles complex French and Unicode characters safely", () => {
    const unicodeText =
      "Étrange… j’avance — encore 🙂 et l'aube dorée « resplendit » au loin sans jamais s'éteindre.";
    const preview = createPassagePreview(unicodeText, { fullThreshold: 200 });

    assert.strictEqual(preview.kind, "full");
    assert.strictEqual(preview.text, unicodeText);
    assert.ok(preview.text.includes("🙂"));
    assert.ok(preview.text.includes("« resplendit »"));
  });

  it("trims at natural word boundaries instead of slicing words in half", () => {
    const text =
      "Première phrase complète et concise. Deuxième phrase avec des termes spécifiques tels que dynamicité et structure continue.";
    const preview = createPassagePreview(text, {
      fullThreshold: 50,
      headTarget: 30,
      tailTarget: 25,
    });

    assert.strictEqual(preview.kind, "head-tail");
    // Verify head doesn't end in the middle of a word like "conc..." when space was nearby
    assert.ok(!preview.head?.endsWith("con"));
    assert.ok(!preview.tail?.startsWith("tels"));
  });
});
