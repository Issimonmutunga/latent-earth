export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface EmbeddingQuery {
  bounds: BoundingBox;
  resolution?: number;
  date?: string;
  sampleSize?: number;
}

export interface EmbeddingPoint {
  id: string;
  lon: number;
  lat: number;
  date?: string;
  vector: Float32Array;
}

export interface EmbeddingResult {
  sourceId: string;
  query: EmbeddingQuery;
  points: EmbeddingPoint[];
  requested: number;
  retrievedAt: string;
  note?: string;
}

export type SourceStatus = "mock-only" | "integration-pending" | "available";

export interface EmbeddingSource {
  id: string;
  name: string;
  description: string;
  dimensions: number;
  spatialResolution: number;
  temporalCoverage: string;
  status: SourceStatus;
  providerConnection?: "earth-engine";
  /** Inclusive year range the researcher can pick from, when the source is annual. */
  availableYears?: { first: number; last: number };
  query(request: EmbeddingQuery): Promise<EmbeddingResult>;
}

/** Tabs of the results panel; the map itself is always visible. */
export type ViewMode = "inspect" | "embedding" | "similarity" | "analysis";

/** One real ground-truth observation supplied by the researcher. */
export interface TargetRow {
  lat: number;
  lon: number;
  label?: string;
  value?: number;
}

/**
 * A real target/label layer attached by the researcher. Rows keep their own
 * coordinates so the target survives re-retrieval: they are joined to the
 * nearest sampled point whenever the sample changes.
 */
export interface Target {
  id: string;
  name: string;
  /** label -> class names; value -> numeric ground truth */
  kind: "label" | "value";
  origin: "upload" | "manual";
  rows: TargetRow[];
}

export type RetrievalStatus =
  | { kind: "idle" }
  | { kind: "retrieving"; requested: number }
  | { kind: "ready" }
  | { kind: "zero-results" }
  | { kind: "error"; message: string };