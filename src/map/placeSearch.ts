import type { BoundingBox } from "../types/embedding.ts";

export interface PlaceResult {
  name: string;
  bounds: BoundingBox;
}

/** Smallest box a search result is widened to, in degrees, so points have room to spread. */
const MIN_RESULT_SPAN = 0.05;

function widen(b: BoundingBox): BoundingBox {
  const cx = (b.west + b.east) / 2;
  const cy = (b.south + b.north) / 2;
  const hw = Math.max(MIN_RESULT_SPAN, b.east - b.west) / 2;
  const hh = Math.max(MIN_RESULT_SPAN, b.north - b.south) / 2;
  return { west: cx - hw, east: cx + hw, south: cy - hh, north: cy + hh };
}

/** Place-name search via OpenStreetMap Nominatim (one request per explicit search). */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Search failed (${res.status}).`);
  const data = (await res.json()) as Array<{ display_name: string; boundingbox: string[] }>;
  return data.map((d) => {
    const [south, north, west, east] = d.boundingbox.map(Number);
    return { name: d.display_name, bounds: widen({ west, south, east, north }) };
  });
}
