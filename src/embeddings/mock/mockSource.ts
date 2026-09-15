import type {
  BoundingBox,
  EmbeddingPoint,
  EmbeddingQuery,
  EmbeddingResult,
  EmbeddingSource,
} from "../../types/embedding.ts";

/**
 * DEV-ONLY mock embedding source.
 *
 * This is a development harness for building and testing the UI skeleton
 * (phase 1 of the development spec). It is intentionally placed outside the
 * production registry: it must never be reachable by a shipped build. The
 * application is wired to register this source only when `import.meta.env.DEV`
 * is true, and the app treats every embedding viewport as "real data only".
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic mock embeddings with visible cluster structure. */
export function generateMockSample(
  bounds: BoundingBox,
  count: number,
  dimensions: number,
  seed = 20250101,
): EmbeddingPoint[] {
  const rand = mulberry32(seed);
  const points: EmbeddingPoint[] = [];

  const centroids: number[][] = [];
  for (let c = 0; c < 4; c += 1) {
    const centroid: number[] = [];
    for (let d = 0; d < dimensions; d += 1) {
      const axis = (c + d) % 3;
      centroid.push(axis === 0 ? 1.4 : axis === 1 ? -1.1 : 0.4);
    }
    centroids.push(centroid);
  }

  for (let i = 0; i < count; i += 1) {
    const lon = lerp(bounds.west, bounds.east, rand());
    const lat = lerp(bounds.south, bounds.north, rand());
    const cluster = Math.floor(rand() * centroids.length);
    const vector = new Float32Array(dimensions);
    const centroid = centroids[cluster];
    for (let d = 0; d < dimensions; d += 1) {
      vector[d] = centroid[d] + (rand() - 0.5) * 0.9 + Math.cos(lat) * 0.25;
    }
    points.push({
      id: `mock-${i}`,
      lon,
      lat,
      vector,
    });
  }
  return points;
}

export function createMockSource(dimensions = 64): EmbeddingSource {
  return {
    id: "mock",
    name: "Mock (dev-only)",
    description:
      "Synthetic sample generator for UI development. Never present in shipped builds.",
    dimensions,
    spatialResolution: 100,
    temporalCoverage: "n/a",
    status: "mock-only",
    async query(request: EmbeddingQuery): Promise<EmbeddingResult> {
      const sampleSize = request.sampleSize ?? 500;
      const points = generateMockSample(request.bounds, sampleSize, dimensions);
      return {
        sourceId: "mock",
        query: request,
        points,
        requested: sampleSize,
        retrievedAt: new Date().toISOString(),
        note: "Mock data — development only.",
      };
    },
  };
}