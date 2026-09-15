import type { EmbeddingSource } from "../../types/embedding.ts";
import { alphaEarthSource } from "../adapters/alphaearth.ts";
import { tesseraSource } from "../adapters/tessera.ts";
import { claySource } from "../adapters/clay.ts";

/**
 * Registry of embedding sources.
 * Real providers are listed here as soon as their adapter exists, whether
 * or not the network integration is verified. Adapters that have not been
 * verified surface explicit "not integrated" errors (never fabricated data).
 */
export const embeddingRegistry: readonly EmbeddingSource[] = [
  alphaEarthSource,
  tesseraSource,
  claySource,
];

export function getSource(id: string): EmbeddingSource | undefined {
  return embeddingRegistry.find((s) => s.id === id);
}

export function availableSources(): EmbeddingSource[] {
  return embeddingRegistry.filter((s) => s.status !== "integration-pending");
}