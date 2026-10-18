import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorkspace, type StepId } from "../../app/workspace.tsx";
import { usePointAnnotations } from "../../app/annotations.ts";
import { downloadText, sampleToCsv, sampleToGeoJson, sessionSummary } from "../../app/export.ts";
import type { Theme } from "../../app/theme.tsx";
import { getEarthEngineProject, subscribeEarthEngine } from "../../embeddings/gee/connection.ts";

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

function Logo() {
  return (
    <svg className="brand__logo" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--accent-ink)" strokeWidth="2" />
      <path d="M7.5 16h17M16 7.5c3 3 3 14 0 17M16 7.5c-3 3-3 14 0 17" fill="none" stroke="var(--accent-ink)" strokeWidth="1.4" />
    </svg>
  );
}

interface AppHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function AppHeader({ theme, onToggleTheme }: AppHeaderProps) {
  const { state, notify, setOpenStep, togglePanel, openGuide, setView } = useWorkspace();
  const annotations = usePointAnnotations();
  const eeProject = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useDismiss(exportOpen, () => setExportOpen(false));
  const { sample, source, clusters, target, area, sampleIsStale } = state;

  const sourceReady = Boolean(source) && !(source?.providerConnection === "earth-engine" && !eeProject);
  const steps: Array<{ id: StepId | "explore"; label: string; done: boolean }> = [
    { id: "source", label: "Source", done: sourceReady },
    { id: "area", label: "Area", done: Boolean(area) },
    { id: "sample", label: "Retrieve", done: Boolean(sample) && !sampleIsStale },
    { id: "explore", label: "Explore", done: Boolean(clusters || state.queryPointId || target) },
  ];
  const current = steps.findIndex((s) => !s.done);

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

  function goTo(id: StepId | "explore") {
    if (id === "explore") {
      togglePanel("right", true);
      setView("inspect");
    } else {
      setOpenStep(id);
    }
  }

  return (
    <header className="app-header">
      <button
        type="button"
        className={`icon-btn icon-btn--flat panel-toggle${state.leftPanelOpen ? " is-on" : ""}`}
        onClick={() => togglePanel("left")}
        aria-pressed={state.leftPanelOpen}
        title="Workflow & layers panel ([)"
        aria-label="Toggle workflow panel"
      >
        <svg viewBox="0 0 20 20" aria-hidden>
          <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="2.5" y="3.5" width="5.5" height="13" rx="1.5" fill="currentColor" opacity="0.55" />
        </svg>
      </button>

      <div className="brand">
        <Logo />
        <span className="brand__name">Latent Earth</span>
      </div>

      <nav className="stepper" aria-label="Workflow progress">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`stepper__item${s.done ? " is-done" : ""}${i === current ? " is-current" : ""}`}
            onClick={() => goTo(s.id)}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="stepper__dot" aria-hidden>
              {s.done ? "✓" : i + 1}
            </span>
            <span className="stepper__label">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="app-header__tools">
        <div className="menu-anchor" ref={exportRef}>
          <button
            type="button"
            className="icon-btn icon-btn--flat"
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

        <button
          type="button"
          className="icon-btn icon-btn--flat"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>

        <button type="button" className="icon-btn icon-btn--flat" title="Guide & shortcuts (?)" onClick={() => openGuide("welcome")}>
          ? <span className="icon-btn__label">Guide</span>
        </button>

        <button
          type="button"
          className={`icon-btn icon-btn--flat panel-toggle${state.rightPanelOpen ? " is-on" : ""}`}
          onClick={() => togglePanel("right")}
          aria-pressed={state.rightPanelOpen}
          title="Results panel (])"
          aria-label="Toggle results panel"
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="12" y="3.5" width="5.5" height="13" rx="1.5" fill="currentColor" opacity="0.55" />
          </svg>
        </button>
      </div>
    </header>
  );
}
