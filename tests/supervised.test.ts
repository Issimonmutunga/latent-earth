import { describe, expect, it } from "vitest";
import {
  classifyLeaveOneOut,
  correlateDimensions,
  pearson,
  predictLabels,
  regressLeaveOneOut,
} from "../src/analysis/supervised.ts";

const v = (...xs: number[]) => new Float64Array(xs);

describe("pearson", () => {
  it("is 1 for perfectly correlated and 0 for constant input", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("correlates each dimension separately", () => {
    const r = correlateDimensions([v(1, 5), v(2, 5.1), v(3, 4.9)], [10, 20, 30]);
    expect(r[0]).toBeCloseTo(1);
    expect(Math.abs(r[1])).toBeLessThan(1);
  });
});

describe("k-NN", () => {
  const vectors = [v(1, 0), v(0.9, 0.1), v(1, 0.05), v(0, 1), v(0.1, 0.9), v(0.05, 1)];
  const labels = ["a", "a", "a", "b", "b", "b"];

  it("classifies separable clusters perfectly with leave-one-out", () => {
    const report = classifyLeaveOneOut(vectors, labels, 2);
    expect(report.accuracy).toBe(1);
    expect(report.baseline).toBe(0.5);
    expect(report.macroF1).toBe(1);
    expect(report.confusion).toEqual([
      [3, 0],
      [0, 3],
    ]);
  });

  it("predicts labels for new vectors", () => {
    expect(predictLabels(vectors, labels, [v(1, 0.02), v(0.02, 1)], 3)).toEqual(["a", "b"]);
  });

  it("regresses values with positive R² when structure exists", () => {
    const report = regressLeaveOneOut(vectors, [1, 1.1, 0.9, 5, 5.2, 4.8], 2);
    expect(report.r2).toBeGreaterThan(0.9);
  });
});
