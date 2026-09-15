import type { EmbeddingQuery, EmbeddingResult, EmbeddingSource } from "../../types/embedding.ts";

/**
 * TESSERA adapter — integration-pending.
 * No public API contract has been verified. Do not fabricate network calls;
 * the adapter surfaces explicit "not integrated" errors until a real
 * documented interface exists.
 */
export const tesseraSource: EmbeddingSource = {
  id: "tessera",
  name: "TESSERA",
  description:
    "Spatio-temporal Earth-observation embeddings from a large-scale pretrained model.",
  dimensions: 512,
  spatialResolution: 30,
  temporalCoverage: "2017 – present",
  status: "integration-pending",
  async query(_request: EmbeddingQuery): Promise<EmbeddingResult> {
    throw new Error(
      "TESSERA is not integrated yet. Provider documentation must be consulted before implementing network calls.",
    );
  },
};