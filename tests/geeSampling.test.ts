import { describe, expect, it } from "vitest";
import type { BoundingBox } from "../src/types/embedding.ts";
import type { EarthEngineSampleFeature } from "../src/types/earthengine.ts";
import { buildSampleGrid, featuresToEmbeddingPoints } from "../src/embeddings/gee/sampling.ts";
import { ALPHAEARTH } from "../src/embeddings/gee/config.ts";

const bounds: BoundingBox = { west: -10, south: 40, east: 15, north: 55 };

describe("buildSampleGrid", () => {
  it("produces exactly the requested number of points", () => {
    expect(buildSampleGrid(bounds, 0)).toHaveLength(0);
    expect(buildSampleGrid(bounds, -3)).toHaveLength(0);
    expect(buildSampleGrid(bounds, 1)).toHaveLength(1);
    expect(buildSampleGrid(bounds, 500)).toHaveLength(500);
    expect(buildSampleGrid(bounds, 2000)).toHaveLength(2000);
  });

  it("keeps every point inside the bbox", () => {
    for (const point of buildSampleGrid(bounds, 1200)) {
      expect(point.lon).toBeGreaterThanOrEqual(bounds.west);
      expect(point.lon).toBeLessThanOrEqual(bounds.east);
      expect(point.lat).toBeGreaterThanOrEqual(bounds.south);
      expect(point.lat).toBeLessThanOrEqual(bounds.north);
    }
  });

  it("assigns unique sequential indices", () => {
    const grid = buildSampleGrid(bounds, 777);
    const indices = grid.map((p) => p.i);
    expect(new Set(indices).size).toBe(777);
    expect(indices[0]).toBe(0);
  });
});

describe("featuresToEmbeddingPoints", () => {
  function feature(i: number, lon: number, lat: number, mask?: number): EarthEngineSampleFeature {
    const properties: Record<string, number | string | null> = { i };
    for (let b = 0; b < ALPHAEARTH.bands.length; b += 1) {
      properties[ALPHAEARTH.bands[b]] = b === mask ? null : b / 100;
    }
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties,
    };
  }

  it("maps full features to embedding points with 64 dims", () => {
    const points = featuresToEmbeddingPoints([feature(0, 1, 2, -1), feature(1, 3, 4, -1)], 2024);
    expect(points).toHaveLength(2);
    expect(points[0].id).toBe("alphaearth-0");
    expect(points[0].lon).toBe(1);
    expect(points[0].lat).toBe(2);
    expect(points[0].date).toBe("2024");
    expect(points[0].vector).toHaveLength(64);
    expect(points[1].vector[7]).toBeCloseTo(0.07);
  });

  it("drops masked-out features where a band is null", () => {
    const points = featuresToEmbeddingPoints([feature(0, 1, 2, 10), feature(1, 3, 4, -1)], 2024);
    expect(points).toHaveLength(1);
    expect(points[0].id).toBe("alphaearth-1");
  });

  it("drops features without usable geometry", () => {
    const broken: EarthEngineSampleFeature = { ...feature(0, 1, 2, -1), geometry: null };
    expect(featuresToEmbeddingPoints([broken, feature(2, 5, 6, -1)], 2024)).toHaveLength(1);
  });

  it("returns points ordered by index", () => {
    const points = featuresToEmbeddingPoints([feature(9, 1, 2, -1), feature(3, 3, 4, -1)], 2024);
    expect(points.map((p) => p.id)).toEqual(["alphaearth-3", "alphaearth-9"]);
  });
});