import type { EmbeddingQuery, EmbeddingResult, EmbeddingSource } from "../../types/embedding.ts";

/**
 * Clay adapter — integration-pending.
 * No public API contract has been verified. Do not fabricate network calls;
 * the adapter surfaces explicit "not integrated" errors until a real
 * documented interface exists.
 */
export const claySource: EmbeddingSource = {
  id: "clay",
  name: "Clay",
  description: "Multimodal, multi-temporal Foundation Model for the Earth system.",
  dimensions: 768,
  spatialResolution: 10,
  temporalCoverage: "2016 – present",
  status: "integration-pending",
  async query(_request: EmbeddingQuery): Promise<EmbeddingResult> {
    throw new Error(
      "Clay is not integrated yet. Provider documentation must be consulted before implementing network calls.",
    );
  },
};