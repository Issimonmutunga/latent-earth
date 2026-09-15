/** Minimal GeoJSON shapes used by the map layers. */

export interface GeoFeature<T = GeoJsonCoordinates> {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: {
    type: "Point" | "Polygon" | string;
    coordinates: T;
  };
}

export type GeoFeatureCollection = { type: "FeatureCollection"; features: GeoFeature[] };

export type GeoJsonCoordinates = [number, number] | number[][] | number[][][];