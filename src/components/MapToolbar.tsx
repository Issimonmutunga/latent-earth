import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import { getViewBounds } from "../map/mapHandle.ts";
import { searchPlaces, type PlaceResult } from "../map/placeSearch.ts";
import { formatArea } from "./AreaPanel.tsx";

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`map-tool${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      data-tip={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
  );
}

/** Place search and drawing tools, docked to the map's top-left corner. */
export default function MapToolbar() {
  const { state, startDrawing, stopDrawing, setArea, flyToBounds, notify } = useWorkspace();
  const { drawing, area, sample } = state;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!results) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResults(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [results]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPlaces(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function goTo(r: PlaceResult) {
    flyToBounds(r.bounds);
    setResults(null);
  }

  function useAsArea(r: PlaceResult) {
    setArea(r.bounds, { fly: true });
    notify(`Area set to ${r.name.split(",")[0]}`);
    setResults(null);
  }

  function zoomToPoints() {
    if (!sample?.points.length) return;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const p of sample.points) {
      west = Math.min(west, p.lon);
      east = Math.max(east, p.lon);
      south = Math.min(south, p.lat);
      north = Math.max(north, p.lat);
    }
    flyToBounds({ west, south, east, north });
  }

  return (
    <div className="map-tools">
      <div className="map-search" ref={boxRef}>
        <form onSubmit={search} role="search">
          <span className="map-search__icon" aria-hidden>
            ⌕
          </span>
          <input
            className="map-search__input"
            type="search"
            placeholder="Search places…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search places"
          />
          {searching && <span className="map-search__busy" aria-hidden />}
        </form>
        {(results || error) && (
          <div className="map-search__results">
            {error && <p className="popover-copy popover-copy--error">{error}</p>}
            {results?.length === 0 && <p className="popover-copy popover-copy--muted">No places found.</p>}
            {results?.map((r, i) => (
              <div key={`${i}:${r.name}`} className="map-search__result">
                <button type="button" className="map-search__go" onClick={() => goTo(r)} title="Fly there">
                  <span className="map-search__name">{r.name}</span>
                  <span className="map-search__meta">{formatArea(r.bounds)}</span>
                </button>
                <button type="button" className="btn btn--small" onClick={() => useAsArea(r)}>
                  Use as area
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="map-toolbar" role="toolbar" aria-label="Map tools">
        <ToolButton label={drawing ? "Cancel drawing" : "Draw area"} shortcut="D" active={drawing} onClick={() => (drawing ? stopDrawing() : startDrawing())}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="3.5" y="5" width="13" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 2" />
            <circle cx="3.5" cy="5" r="1.6" fill="currentColor" />
            <circle cx="16.5" cy="15" r="1.6" fill="currentColor" />
          </svg>
        </ToolButton>
        <ToolButton
          label="Use current view as area"
          onClick={() => {
            const b = getViewBounds();
            if (b) {
              setArea(b);
              notify("Area set to the current map view");
            }
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </ToolButton>
        <span className="map-toolbar__sep" />
        <ToolButton label="Zoom to area" disabled={!area} onClick={() => area && flyToBounds(area)}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="4" y="4" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 2" />
            <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </ToolButton>
        <ToolButton label="Zoom to points" disabled={!sample} onClick={zoomToPoints}>
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="6" cy="7" r="1.8" fill="currentColor" />
            <circle cx="13" cy="5.5" r="1.8" fill="currentColor" />
            <circle cx="9.5" cy="12" r="1.8" fill="currentColor" />
            <circle cx="15" cy="14" r="1.8" fill="currentColor" />
            <circle cx="5" cy="15" r="1.8" fill="currentColor" />
          </svg>
        </ToolButton>
      </div>

    </div>
  );
}

/** Centered instruction shown on the map while drawing an area. */
export function DrawBanner() {
  const { state, stopDrawing } = useWorkspace();
  if (!state.drawing) return null;
  return (
    <div className="draw-banner" role="status">
      <span>
        <strong>Drag on the map</strong> to draw your area
        {state.area ? ` — replaces the current ${formatArea(state.area)}` : ""}
      </span>
      <button type="button" className="btn btn--small" onClick={stopDrawing}>
        Cancel <kbd>Esc</kbd>
      </button>
    </div>
  );
}
