import type maplibregl from "maplibre-gl";
import type { BoundingBox } from "../types/embedding.ts";

/** The single live map instance, for controls that need the current viewport. */
let current: maplibregl.Map | null = null;

export function setMapInstance(map: maplibregl.Map | null): void {
  current = map;
}

/** The visible map extent, clamped to valid coordinates. */
export function getViewBounds(): BoundingBox | null {
  if (!current) return null;
  const b = current.getBounds();
  return {
    west: Math.max(-180, b.getWest()),
    south: Math.max(-85, b.getSouth()),
    east: Math.min(180, b.getEast()),
    north: Math.min(85, b.getNorth()),
  };
}
