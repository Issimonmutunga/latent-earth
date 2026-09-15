import type { EmbeddingPoint } from "../types/embedding.ts";

export function cosineSimilarity(a: Float32Array | Float64Array, b: Float32Array | Float64Array): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length.");
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na * nb);
  if (denom === 0) return 0;
  return dot / denom;
}

export interface SimilarityScore {
  point: EmbeddingPoint;
  similarity: number;
}

/** Rank every point by cosine similarity to the query point. */
export function rankBySimilarity(
  source: EmbeddingPoint[],
  query: EmbeddingPoint,
): SimilarityScore[] {
  return source
    .map((point) => ({ point, similarity: cosineSimilarity(query.vector, point.vector) }))
    .sort((a, b) => b.similarity - a.similarity);
}