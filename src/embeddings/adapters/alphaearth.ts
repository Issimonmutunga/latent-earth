import type {
  EmbeddingQuery,
  EmbeddingResult,
  EmbeddingSource,
  SourceStatus,
} from "../../types/embedding.ts";
import { ALPHAEARTH, getGeeProjectId, isConfigured, resolveYear } from "../gee/config.ts";
import { getEarthEngineApi } from "../gee/connection.ts";
import { buildSampleGrid, featuresToEmbeddingPoints } from "../gee/sampling.ts";

const DEFAULT_SAMPLE_SIZE = 500;

export const alphaEarthSource: EmbeddingSource = {
  id: "alphaearth",
  name: "AlphaEarth",
  description:
    "Satellite foundation-model embeddings for global land observations, served through Google Earth Engine.",
  dimensions: 64,
  spatialResolution: 10,
  temporalCoverage: "2017 – present",
  providerConnection: "earth-engine",
  get status(): SourceStatus {
    return isConfigured() ? "available" : "integration-pending";
  },
  async query(request: EmbeddingQuery): Promise<EmbeddingResult> {
    const projectId = getGeeProjectId();
    if (!projectId) {
      throw new Error(
        "AlphaEarth is served through Google Earth Engine. Set VITE_GEE_PROJECT_ID to your Earth Engine-enabled Cloud Project ID to use it.",
      );
    }
    const api = getEarthEngineApi();
    if (!api) {
      throw new Error(
        "Connect to Google Earth Engine first (Source → Connect), then retry the retrieve.",
      );
    }

    const year = resolveYear(request.date);
    const sampleSize = request.sampleSize ?? DEFAULT_SAMPLE_SIZE;
    const grid = buildSampleGrid(request.bounds, sampleSize);
    const { west, south, east, north } = request.bounds;

    const region = api.Geometry.Rectangle([west, south, east, north]);
    const image = api
      .ImageCollection(ALPHAEARTH.collectionId)
      .filterDate(`${year}-01-01`, `${year + 1}-01-01`)
      .filterBounds(region)
      .mosaic()
      .select(ALPHAEARTH.bands);
    const samples = api.FeatureCollection(
      grid.map((point) => api.Feature(api.Geometry.Point([point.lon, point.lat]), { i: point.i })),
    );

    const sampled = await image
      .sampleRegions(samples, null, ALPHAEARTH.spatialResolution, "EPSG:4326", null, true)
      .getInfo();

    const points = featuresToEmbeddingPoints(sampled.features, year);
    return {
      sourceId: "alphaearth",
      query: request,
      points,
      requested: grid.length,
      retrievedAt: new Date().toISOString(),
      note: ALPHAEARTH.attribution,
    };
  },
};