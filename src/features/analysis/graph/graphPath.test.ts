import { describe, it } from "node:test";
import assert from "node:assert";
import {
  computeMonotoneCubicControlPoints,
  generateSemanticPathSegment,
} from "./graphPath";

describe("graphPath — Monotone Cubic Spline & Semantic Geometry", () => {
  it("computes control points for 2 points without crashing", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ];
    const cps = computeMonotoneCubicControlPoints(points);
    assert.strictEqual(cps.length, 1);
    assert.ok(Math.abs(cps[0].cp1.x - 33.33) < 0.1);
    assert.ok(Math.abs(cps[0].cp2.x - 66.67) < 0.1);
  });

  it("guarantees flat horizontal tangent at local peak (no overshoot)", () => {
    // Peak at index 1: (50, 10) between (0, 0) and (100, 0)
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: 100, y: 0 },
    ];
    const cps = computeMonotoneCubicControlPoints(points);
    assert.strictEqual(cps.length, 2);

    // Incoming curve at peak: cp2.y must be exactly 10 (horizontal slope, no overshoot > 10)
    assert.strictEqual(cps[0].cp2.y, 10);
    // Outgoing curve from peak: cp1.y must be exactly 10 (horizontal slope)
    assert.strictEqual(cps[1].cp1.y, 10);
  });

  it("isolates slopes across discontinuous movements like ruptures", () => {
    const points = [
      { x: 0, y: 2 },
      { x: 50, y: 8 },
      { x: 100, y: 1 },
      { x: 150, y: 9 },
    ];
    // Discontinuity at interval 1 (between index 1 and 2)
    const isDiscontinuous = (idx: number) => idx === 1;
    const cps = computeMonotoneCubicControlPoints(points, isDiscontinuous);
    assert.strictEqual(cps.length, 3);
  });

  it("generates smooth cubic Bezier when control points are supplied for linear kind", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 50 };
    const cp = {
      cp1: { x: 33.33, y: 10 },
      cp2: { x: 66.67, y: 40 },
    };

    const cmd = generateSemanticPathSegment(p1, p2, "linear", cp);
    assert.ok(cmd.startsWith("C "));
    assert.ok(cmd.includes("33.33 10.00"));
    assert.ok(cmd.includes("66.67 40.00"));
    assert.ok(cmd.includes("100.00 50.00"));
  });

  it("generates straight line when control points are omitted for linear kind", () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 50 };

    const cmd = generateSemanticPathSegment(p1, p2, "linear");
    assert.strictEqual(cmd, "L 100.00 50.00");
  });

  it("never smooths dramatic discontinuous movements (drop, rupture, plateau, spike)", () => {
    const p1 = { x: 0, y: 10 };
    const p2 = { x: 100, y: 2 };
    const cp = {
      cp1: { x: 33.33, y: 10 },
      cp2: { x: 66.67, y: 2 },
    };

    // Drop must keep near-vertical plunge (tiger-style negative space rule)
    const dropCmd = generateSemanticPathSegment(p1, p2, "drop", cp);
    assert.ok(dropCmd.startsWith("L "));
    assert.ok(!dropCmd.includes("C "));

    // Rupture must remain an orthogonal step
    const ruptureCmd = generateSemanticPathSegment(p1, p2, "rupture", cp);
    assert.ok(ruptureCmd.startsWith("L "));
    assert.ok(!ruptureCmd.includes("C "));

    // Plateau must hold level
    const plateauCmd = generateSemanticPathSegment(p1, p2, "plateau", cp);
    assert.ok(plateauCmd.startsWith("L "));
    assert.ok(!plateauCmd.includes("C "));

    // Spike must step rapidly
    const spikeCmd = generateSemanticPathSegment(p1, p2, "spike", cp);
    assert.ok(spikeCmd.startsWith("L "));
    assert.ok(!spikeCmd.includes("C "));
  });
});
