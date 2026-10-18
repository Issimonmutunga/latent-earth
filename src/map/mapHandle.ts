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

/** Cursor position and zoom for the status bar, published outside React renders. */
export interface MapStatus {
  cursor: { lng: number; lat: number } | null;
  zoom: number;
}

let status: MapStatus = { cursor: null, zoom: 0 };
const statusListeners = new Set<() => void>();

export function publishMapStatus(next: Partial<MapStatus>): void {
  status = { ...status, ...next };
  for (const listener of statusListeners) listener();
}

export function subscribeMapStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getMapStatus(): MapStatus {
  return status;
}
