export interface EarthEngineGeometry {
  readonly kind: "geometry";
}

export interface EarthEngineFeature {
  readonly kind: "feature";
}

export interface EarthEngineFeatureCollection {
  /** Asynchronous when given a callback (the synchronous form blocks the page). */
  getInfo(callback: (result: EarthEngineSampleResult | undefined, error?: string) => void): void;
}

export interface EarthEngineImage {
  select(bands: string[]): EarthEngineImage;
  sampleRegions(args: {
    collection: EarthEngineFeatureCollection;
    properties?: string[];
    scale?: number;
    projection?: string;
    tileScale?: number;
    geometries?: boolean;
  }): EarthEngineFeatureCollection;
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
    setAuthToken(
      clientId: string,
      tokenType: string,
      accessToken: string,
      expiresIn: number,
      extraScopes?: string[],
      callback?: () => void,
      updateAuthLibrary?: boolean,
    ): void;
    setAuthTokenRefresher(
      refresher: (
        authArgs: { scope: string },
        callback: (result: { access_token?: string; token_type?: string; expires_in?: number; error?: string }) => void,
      ) => void,
    ): void;
    clearAuthToken?: () => void;
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

/** Minimal Google Identity Services token-client surface. */
export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

export interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string; message?: string }) => void;
      }): TokenClient;
      revoke?(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    ee?: EarthEngineApi;
    google?: GoogleIdentityServices;
  }
}