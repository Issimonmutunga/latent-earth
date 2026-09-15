import type { BoundingBox, EmbeddingPoint } from "../../types/embedding.ts";
import type { EarthEngineSampleFeature } from "../../types/earthengine.ts";
import { ALPHAEARTH } from "./config.ts";

export interface GridPoint {
  i: number;
  lon: number;
  lat: number;
}

export function buildSampleGrid(bounds: BoundingBox, count: number): GridPoint[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  const width = Math.max(0, bounds.east - bounds.west);
  const height = Math.max(0, bounds.north - bounds.south);
  const aspect = width / Math.max(height, 1e-9);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const grid: GridPoint[] = [];
  for (let r = 0; r < rows && grid.length < count; r += 1) {
    for (let c = 0; c < cols && grid.length < count; c += 1) {
      grid.push({
        i: r * cols + c,
        lon: bounds.west + width * ((c + 0.5) / cols),
        lat: bounds.south + height * ((r + 0.5) / rows),
      });
    }
  }
  return grid;
}

export function featuresToEmbeddingPoints(
  features: EarthEngineSampleFeature[],
  year: number,
): EmbeddingPoint[] {
  const rows: Array<{ i: number; point: EmbeddingPoint }> = [];
  for (const feature of features) {
    const i = Number(feature.properties.i);
    if (!Number.isFinite(i)) continue;
    const coords = feature.geometry?.coordinates;
    if (!coords) continue;
    const values = new Array<number>(ALPHAEARTH.bands.length);
    let complete = true;
    for (let b = 0; b < ALPHAEARTH.bands.length; b += 1) {
      const value = feature.properties[ALPHAEARTH.bands[b]];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        complete = false;
        break;
      }
      values[b] = value;
    }
    if (!complete) continue;
    const index = Math.trunc(i);
    rows.push({
      i: index,
      point: {
        id: `alphaearth-${index}`,
        lon: coords[0],
        lat: coords[1],
        date: String(year),
        vector: new Float32Array(values),
      },
    });
  }
  rows.sort((a, b) => a.i - b.i);
  return rows.map((row) => row.point);
}