export interface EarthEngineGeometry {
  readonly kind: "geometry";
}

export interface EarthEngineFeature {
  readonly kind: "feature";
}

export interface EarthEngineFeatureCollection {
  getInfo(): Promise<EarthEngineSampleResult>;
}

export interface EarthEngineImage {
  select(bands: string[]): EarthEngineImage;
  sampleRegions(
    collection: EarthEngineFeatureCollection,
    properties: Record<string, unknown> | null,
    scale: number,
    projection: string,
    tileScale: number | null,
    geometries: boolean,
  ): EarthEngineFeatureCollection;
}

export interface EarthEngineImageCollection extends EarthEngineImage {
  filterDate(start: string, end: string): EarthEngineImageCollection;
  filterBounds(geometry: EarthEngineGeometry): EarthEngineImageCollection;
  mosaic(): EarthEngineImage;
}

export interface EarthEngineSampleFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: Record<string, number | string | null>;
}

export interface EarthEngineSampleResult {
  type: "FeatureCollection";
  features: EarthEngineSampleFeature[];
}

export interface EarthEngineApi {
  initialize(
    baseurl: unknown | null,
    tileurl: unknown | null,
    onInitialized: (() => void) | null,
    onError: ((err: unknown) => void) | null,
    accessToken?: unknown,
    project?: string,
  ): void;
  data: {
    authenticateViaPopup(onSuccess: () => void, onError?: (err: unknown) => void): void;
    reset?: () => void;
  };
  Geometry: {
    Point(coordinates: [number, number]): EarthEngineGeometry;
    Rectangle(coordinates: number[]): EarthEngineGeometry;
  };
  ImageCollection(id: string): EarthEngineImageCollection;
  Feature(
    geometry: EarthEngineGeometry,
    properties?: Record<string, number | string>,
  ): EarthEngineFeature;
  FeatureCollection(features: EarthEngineFeature[]): EarthEngineFeatureCollection;
}

declare global {
  interface Window {
    ee?: EarthEngineApi;
  }
}