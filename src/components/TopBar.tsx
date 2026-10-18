import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import { usePointAnnotations } from "../app/annotations.ts";
import { downloadText, sampleToCsv, sampleToGeoJson, sessionSummary } from "../app/export.ts";
import { BASEMAP_LABELS, type BasemapKey } from "../map/basemap.ts";

interface TopBarProps {
  basemap: BasemapKey;
  onBasemap: (key: BasemapKey) => void;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ["D", "Draw an area"],
  ["R", "Retrieve sample"],
  ["1 – 4", "Map · Embedding · Similarity · Analysis"],
  ["B", "Cycle basemap"],
  ["Esc", "Cancel / back to map / close"],
  ["?", "Show this help"],
];

/** Close a floating menu on outside click. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return ref;
}

export default function TopBar({ basemap, onBasemap, helpOpen, onHelp }: TopBarProps) {
  const { state, notify } = useWorkspace();
  const annotations = usePointAnnotations();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useDismiss(exportOpen, () => setExportOpen(false));
  const helpRef = useDismiss(helpOpen, () => onHelp(false));
  const { sample, source, clusters, target } = state;

  const stem = `latent-earth-${source?.id ?? "sample"}-${new Date().toISOString().slice(0, 10)}`;

  function notes(): string[] {
    const out: string[] = [];
    if (clusters) out.push(`Clusters: k-means, k=${clusters.k}, euclidean`);
    if (state.queryPointId) out.push(`Similarity: cosine to ${state.queryPointId}`);
    if (target) out.push(`Target: ${target.name} (${target.kind}, ${target.rows.length} rows, k-NN k=5 cosine)`);
    return out;
  }

  function exportCsv() {
    if (!sample) return;
    downloadText(`${stem}.csv`, sampleToCsv(sample, annotations), "text/csv");
    notify(`Downloaded ${sample.points.length.toLocaleString()} points as CSV`);
    setExportOpen(false);
  }

  function exportGeoJson(withVectors: boolean) {
    if (!sample) return;
    downloadText(`${stem}.geojson`, sampleToGeoJson(sample, annotations, withVectors), "application/geo+json");
    notify("Downloaded GeoJSON");
    setExportOpen(false);
  }

  function copySummary() {
    if (!sample) return;
    void navigator.clipboard?.writeText(sessionSummary(source, sample, notes()));
    notify("Session summary copied");
    setExportOpen(false);
  }

  return (
    <div className="top-bar">
      <div className="segmented" role="radiogroup" aria-label="Basemap">
        {(Object.keys(BASEMAP_LABELS) as BasemapKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={basemap === key}
            className={`segmented__item${basemap === key ? " is-active" : ""}`}
            onClick={() => onBasemap(key)}
            title={`${BASEMAP_LABELS[key]} basemap (B to cycle)`}
          >
            {BASEMAP_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="menu-anchor" ref={exportRef}>
        <button
          type="button"
          className="icon-btn"
          disabled={!sample}
          title={sample ? "Export sample & results" : "Retrieve a sample to export it"}
          aria-expanded={exportOpen}
          onClick={() => setExportOpen((v) => !v)}
        >
          ⤓ <span className="icon-btn__label">Export</span>
        </button>
        {exportOpen && sample && (
          <div className="menu" role="menu">
            <button type="button" className="menu__item" role="menuitem" onClick={exportCsv}>
              <strong>CSV</strong>
              <span>coordinates, results and full embedding vectors</span>
            </button>
            <button type="button" className="menu__item" role="menuitem" onClick={() => exportGeoJson(false)}>
              <strong>GeoJSON</strong>
              <span>points with results — opens in QGIS / geojson.io</span>
            </button>
            <button type="button" className="menu__item" role="menuitem" onClick={() => exportGeoJson(true)}>
              <strong>GeoJSON + vectors</strong>
              <span>larger file, includes embeddings</span>
            </button>
            <button type="button" className="menu__item" role="menuitem" onClick={copySummary}>
              <strong>Copy session summary</strong>
              <span>source, area, sample and methods as text</span>
            </button>
          </div>
        )}
      </div>

      <div className="menu-anchor" ref={helpRef}>
        <button
          type="button"
          className="icon-btn"
          title="Help & shortcuts (?)"
          aria-expanded={helpOpen}
          onClick={() => onHelp(!helpOpen)}
        >
          ?
        </button>
        {helpOpen && (
          <div className="menu menu--help" role="dialog" aria-label="Help">
            <div className="block-title">How it works</div>
            <ol className="help-steps">
              <li>
                <strong>Choose a source</strong> — the embedding model to read.
              </li>
              <li>
                <strong>Pick an area</strong> — draw, search a place, or use the view.
              </li>
              <li>
                <strong>Retrieve</strong> — loads a grid of real embeddings.
              </li>
              <li>
                <strong>Explore</strong> — cluster, find similar places, or attach a target to test
                for a signal.
              </li>
            </ol>
            <div className="block-title">Keyboard shortcuts</div>
            <dl className="shortcut-list">
              {SHORTCUTS.map(([k, label]) => (
                <div key={k} className="shortcut">
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
