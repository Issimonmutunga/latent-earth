import { describe, expect, it } from "vitest";
import { cosineSimilarity, rankBySimilarity } from "../src/analysis/similarity.ts";
import type { EmbeddingPoint } from "../src/types/embedding.ts";

function p(vector: number[], id: string): EmbeddingPoint {
  return { id, lon: 0, lat: 0, vector: new Float32Array(vector) };
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity(new Float32Array([1, 0, 0]), new Float32Array([1, 0, 0]))).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity(new Float32Array([2, 0]), new Float32Array([-1, 0]))).toBeCloseTo(-1);
  });

  it("throws on mismatched lengths", () => {
    expect(() => cosineSimilarity(new Float32Array([1]), new Float32Array([1, 2]))).toThrow();
  });
});

describe("rankBySimilarity", () => {
  it("sorts points by descending similarity to the query", () => {
    const query = p([1, 0, 0], "q");
    const ranked = rankBySimilarity(
      [p([-1, 0, 0], "a"), p([0.9, 0.1, 0], "b"), p([1, 0, 0], "c")],
      query,
    );
    expect(ranked.map((r) => r.point.id)).toEqual(["c", "b", "a"]);
    expect(ranked[0].similarity).toBeCloseTo(1);
    expect(ranked[2].similarity).toBeCloseTo(-1);
  });
});