import { describe, expect, it } from "vitest";
import { kmeans } from "../src/analysis/clustering.ts";

describe("kmeans", () => {
  it("separates two well-separated gaussian clusters", () => {
    const rows: Float32Array[] = [];
    for (let i = 0; i < 100; i += 1) {
      rows.push(new Float32Array([Math.random() * 0.1, Math.random() * 0.1]));
    }
    for (let i = 0; i < 100; i += 1) {
      rows.push(new Float32Array([5 + Math.random() * 0.1, 5 + Math.random() * 0.1]));
    }
    const { assignments } = kmeans(rows, 2);
    const a = assignments.slice(0, 100);
    const b = assignments.slice(100);
    const aCounts = [a.filter((x) => x === 0).length, a.filter((x) => x === 1).length];
    const bCounts = [b.filter((x) => x === 0).length, b.filter((x) => x === 1).length];
    // One cluster dominates each population.
    expect(Math.max(...aCounts)).toBeGreaterThan(90);
    expect(Math.max(...bCounts)).toBeGreaterThan(90);
  });

  it("throws when k exceeds point count", () => {
    expect(() =>
      kmeans([new Float32Array([1, 2]), new Float32Array([3, 4])], 5),
    ).toThrow();
  });

  it("assigns every point a cluster id", () => {
    const rows = Array.from({ length: 30 }, () => new Float32Array([Math.random(), Math.random()]));
    const { assignments } = kmeans(rows, 3);
    expect(assignments).toHaveLength(30);
    assignments.forEach((a) => expect(a).toBeLessThan(3));
  });
});