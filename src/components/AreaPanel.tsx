import { useState } from "react";
import type { BoundingBox } from "../types/embedding.ts";
import { useWorkspace } from "../app/workspace.tsx";
import { getViewBounds } from "../map/mapHandle.ts";

interface PlaceResult {
  name: string;
  bounds: BoundingBox;
}

/** Smallest box a search result is widened to, in degrees, so points have room to spread. */
const MIN_RESULT_SPAN = 0.05;

export function areaKm2(a: BoundingBox): number {
  const midLat = ((a.north + a.south) / 2) * (Math.PI / 180);
  return (a.east - a.west) * 111.32 * Math.cos(midLat) * (a.north - a.south) * 110.57;
}

export function formatArea(a: BoundingBox): string {
  const km2 = areaKm2(a);
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(1)}M km²`;
  if (km2 >= 1000) return `${Math.round(km2).toLocaleString()} km²`;
  return `${km2.toFixed(km2 < 10 ? 2 : 0)} km²`;
}

function widen(b: BoundingBox): BoundingBox {
  const cx = (b.west + b.east) / 2;
  const cy = (b.south + b.north) / 2;
  const hw = Math.max(MIN_RESULT_SPAN, b.east - b.west) / 2;
  const hh = Math.max(MIN_RESULT_SPAN, b.north - b.south) / 2;
  return { west: cx - hw, east: cx + hw, south: cy - hh, north: cy + hh };
}

/** Parse "west, south, east, north" (any separators). */
export function parseBounds(text: string): BoundingBox | string {
  const nums = text.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
    return "Enter four numbers: west, south, east, north.";
  }
  const [west, south, east, north] = nums;
  if (west >= east || south >= north) return "West must be less than east, and south less than north.";
  if (west < -180 || east > 180 || south < -90 || north > 90) return "Coordinates are out of range.";
  return { west, south, east, north };
}

export default function AreaPanel({
  drawing,
  onToggleDrawing,
  onDone,
}: {
  drawing: boolean;
  onToggleDrawing: () => void;
  onDone: () => void;
}) {
  const { state, setArea, clearArea, notify } = useWorkspace();
  const { area } = state;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coords, setCoords] = useState(
    area ? [area.west, area.south, area.east, area.north].map((n) => n.toFixed(4)).join(", ") : "",
  );
  const [coordsError, setCoordsError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`Search failed (${res.status}).`);
      const data = (await res.json()) as Array<{ display_name: string; boundingbox: string[] }>;
      setResults(
        data.map((d) => {
          const [south, north, west, east] = d.boundingbox.map(Number);
          return { name: d.display_name, bounds: widen({ west, south, east, north }) };
        }),
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function choose(bounds: BoundingBox, label?: string) {
    setArea(bounds, { fly: true });
    if (label) notify(`Area set to ${label.split(",")[0]}`);
    onDone();
  }

  function useView() {
    const b = getViewBounds();
    if (!b) return;
    setArea(b);
    notify("Area set to the current map view");
    onDone();
  }

  function applyCoords(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseBounds(coords);
    if (typeof parsed === "string") {
      setCoordsError(parsed);
      return;
    }
    setCoordsError(null);
    choose(parsed);
  }

  return (
    <div className="area-panel">
      <div className="button-row">
        <button type="button" className={`btn ${drawing ? "btn--primary" : ""}`} onClick={onToggleDrawing}>
          {drawing ? "Cancel drawing" : "✎ Draw on map"}
        </button>
        <button type="button" className="btn" onClick={useView}>
          ⬚ Use current view
        </button>
      </div>
      <p className="popover-copy popover-copy--muted">
        Draw: click and drag a box on the map. Tip: zoom in first for a small, detailed area.
      </p>

      <div className="block-title">Search a place</div>
      <form className="inline-form" onSubmit={search}>
        <input
          className="input"
          type="search"
          placeholder="e.g. Nairobi, Lake Victoria, Amazon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Place name"
        />
        <button type="submit" className="btn" disabled={searching || !query.trim()}>
          {searching ? "…" : "Search"}
        </button>
      </form>
      {searchError && <p className="popover-copy popover-copy--error">{searchError}</p>}
      {results && results.length === 0 && <p className="popover-copy popover-copy--muted">No places found.</p>}
      {results && results.length > 0 && (
        <ul className="result-list">
          {results.map((r, i) => (
            <li key={`${i}:${r.name}`}>
              <button type="button" className="result-list__item" onClick={() => choose(r.bounds, r.name)}>
                <span>{r.name}</span>
                <span className="result-list__meta">{formatArea(r.bounds)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="block-title">Coordinates</div>
      <form className="inline-form" onSubmit={applyCoords}>
        <input
          className="input input--mono"
          placeholder="west, south, east, north"
          value={coords}
          onChange={(e) => setCoords(e.target.value)}
          aria-label="Bounding box"
        />
        <button type="submit" className="btn">
          Apply
        </button>
      </form>
      {coordsError && <p className="popover-copy popover-copy--error">{coordsError}</p>}

      {area && (
        <div className="area-summary">
          <span>
            Current area · <strong>{formatArea(area)}</strong>
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={clearArea}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
