import type { EmbeddingQuery, EmbeddingResult, EmbeddingSource } from "../../types/embedding.ts";

/**
 * AlphaEarth adapter — integration-pending.
 * No public API contract has been verified. Do not fabricate network calls;
 * the adapter surfaces explicit "not integrated" errors until a real
 * documented interface exists.
 */
export const alphaEarthSource: EmbeddingSource = {
  id: "alphaearth",
  name: "AlphaEarth",
  description:
    "Satellite foundation-model embeddings for global land observations.",
  dimensions: 64,
  spatialResolution: 10,
  temporalCoverage: "2016 – present",
  status: "integration-pending",
  async query(_request: EmbeddingQuery): Promise<EmbeddingResult> {
    throw new Error(
      "AlphaEarth is not integrated yet. Provider documentation must be consulted before implementing network calls.",
    );
  },
};