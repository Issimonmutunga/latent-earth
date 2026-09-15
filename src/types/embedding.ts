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
  query(request: EmbeddingQuery): Promise<EmbeddingResult>;
}

export type ViewMode = "map" | "embedding" | "similarity" | "analysis";

/** A real target/label layer attached by the researcher (custom target). */
export interface Target {
  id: string;
  name: string;
  /** label -> one set of labeled points; value -> numeric ground truth per point */
  kind: "label" | "value";
  points: Array<{ pointId: string; label?: string; value?: number }>;
}

export type RetrievalStatus =
  | { kind: "idle" }
  | { kind: "retrieving"; requested: number }
  | { kind: "ready" }
  | { kind: "zero-results" }
  | { kind: "error"; message: string };