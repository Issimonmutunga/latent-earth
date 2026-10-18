import type {
  EmbeddingQuery,
  EmbeddingResult,
  EmbeddingSource,
  SourceStatus,
} from "../../types/embedding.ts";
import { ALPHAEARTH, getGeeProjectId, isConfigured, resolveYear } from "../gee/config.ts";
import { describeEarthEngineError, getEarthEngineApi } from "../gee/connection.ts";
import type { EarthEngineSampleResult } from "../../types/earthengine.ts";
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
  availableYears: { first: ALPHAEARTH.firstYear, last: ALPHAEARTH.lastYear },
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
        "Sign in with Google to read AlphaEarth from Earth Engine, then retrieve again.",
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

    const sampled = await new Promise<EarthEngineSampleResult>((resolve, reject) => {
      image
        .sampleRegions(samples, null, ALPHAEARTH.spatialResolution, "EPSG:4326", null, true)
        .getInfo((result, error) => {
          if (error || !result) reject(new Error(describeEarthEngineError(error ?? "Earth Engine returned no data.")));
          else resolve(result);
        });
    });

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