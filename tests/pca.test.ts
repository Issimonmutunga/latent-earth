import { describe, expect, it } from "vitest";
import { pca } from "../src/analysis/pca.ts";

describe("pca", () => {
  it("throws on too few points", () => {
    expect(() => pca([new Float32Array([1, 2])], 2)).toThrow();
  });

  it("throws on ragged dimensionality", () => {
    expect(() =>
      pca([new Float32Array([1, 2]), new Float32Array([1, 2, 3])], 2),
    ).toThrow();
  });

  it("orders components by decreasing variance", () => {
    // Strong spread along axis 0, mild along axis 1.
    const rows: Float32Array[] = [];
    for (let i = 0; i < 400; i += 1) {
      const x = (Math.sin(i) * 5);
      const y = (Math.cos(i * 7) * 0.2);
      rows.push(new Float32Array([x, y]));
    }
    const result = pca(rows, 2);
    expect(result.varianceExplained[0]).toBeGreaterThan(result.varianceExplained[1]);
  });

  it("is deterministic for a fixed input", () => {
    const rows: Float32Array[] = [];
    for (let i = 0; i < 120; i += 1) {
      rows.push(new Float32Array([i % 7, (i % 3) * 1.3, i * 0.01]));
    }
    const a = pca(rows, 2);
    const b = pca(rows, 2);
    expect(a.scores).toEqual(b.scores);
    expect(a.varianceExplained).toEqual(b.varianceExplained);
  });

  it("returns per-point scores matching the input count", () => {
    const rows: Float32Array[] = Array.from({ length: 50 }, (_, i) =>
      new Float32Array([i, i * 2, i * 0.5]),
    );
    const result = pca(rows, 2);
    expect(result.scores).toHaveLength(50);
    expect(result.scores[0]).toHaveLength(2);
  });
});