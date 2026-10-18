import { useCallback, useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "./workspace.tsx";
import { TargetModelProvider } from "./targetModel.tsx";
import { usePointColors } from "./pointColors.ts";
import { formatTargetValue, usePointAnnotations } from "./annotations.ts";
import MapCanvas, { type PointDescription } from "../map/MapCanvas.tsx";
import ControlBar from "../components/ControlBar.tsx";
import ViewSwitcher from "../ui/ViewSwitcher.tsx";
import Inspector from "../components/Inspector.tsx";
import ColorPanel from "../components/ColorPanel.tsx";
import TopBar from "../components/TopBar.tsx";
import Guide from "../components/Guide.tsx";
import Toast from "../ui/Toast.tsx";
import ErrorBoundary from "../ui/ErrorBoundary.tsx";
import EmbeddingView from "../components/views/EmbeddingView.tsx";
import SimilarityView from "../components/views/SimilarityView.tsx";
import AnalysisView from "../components/views/AnalysisView.tsx";
import { ThemeProvider, useTheme, THEME_COLORS } from "./theme.tsx";
import { setMapInstance } from "../map/mapHandle.ts";
import { BASEMAP_LABELS, type BasemapKey } from "../map/basemap.ts";
import type { ViewMode } from "../types/embedding.ts";

const BASEMAP_ORDER: BasemapKey[] = ["dark", "light", "satellite"];
const GUIDE_SEEN_KEY = "latent-earth:guide-seen";
const VIEW_KEYS: Record<string, ViewMode> = { "1": "map", "2": "embedding", "3": "similarity", "4": "analysis" };

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WorkspaceProvider>
          <TargetModelProvider>
            <Workspace />
          </TargetModelProvider>
        </WorkspaceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function Workspace() {
  const api = useWorkspace();
  const { state, setArea, selectPoint, setHoveredPoint, setView, startDrawing, stopDrawing, retrieveSample, notify, openGuide } = api;
  const pointColors = usePointColors();
  const annotations = usePointAnnotations();
  const { theme, setTheme } = useTheme();
  const colors = THEME_COLORS[theme];
  const [basemap, setBasemap] = useState<BasemapKey>(theme === "dark" ? "dark" : "light");

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Keep the street map in step with the theme; leave satellite alone.
    setBasemap((b) => (b === "satellite" ? b : next === "dark" ? "dark" : "light"));
  }, [theme, setTheme]);
  const hasSample = state.sample !== null;

  const describePoint = useCallback(
    (id: string): PointDescription | null => {
      const p = state.sample?.points.find((pt) => pt.id === id);
      if (!p) return null;
      const lines = [`${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°`];
      const cluster = annotations.cluster?.get(id);
      if (cluster !== undefined) lines.push(`Cluster ${cluster + 1}`);
      const sim = annotations.similarity?.get(id);
      if (sim !== undefined) lines.push(`Similarity ${sim.toFixed(3)}`);
      const actual = annotations.target?.get(id);
      if (actual !== undefined) lines.push(`Target: ${formatTargetValue(actual)}`);
      else if (annotations.predicted?.has(id))
        lines.push(`Predicted: ${formatTargetValue(annotations.predicted.get(id))}`);
      return { title: id === state.queryPointId ? `${p.id} · query` : p.id, lines };
    },
    [state.sample, state.queryPointId, annotations],
  );

  // First visit: open the guide once so newcomers know where to start.
  useEffect(() => {
    try {
      if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
        openGuide("welcome");
        localStorage.setItem(GUIDE_SEEN_KEY, "1");
      }
    } catch {
      // No storage: skip the automatic welcome rather than show it every load.
    }
  }, [openGuide]);

  // Keyboard shortcuts — ignored while typing in a field or reading the guide.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || state.guide) return;
      const key = e.key.toLowerCase();
      if (VIEW_KEYS[key] && hasSample) {
        setView(VIEW_KEYS[key]);
      } else if (key === "d") {
        if (state.drawing) stopDrawing();
        else startDrawing();
      } else if (key === "r") {
        if (state.source && state.area) void retrieveSample();
      } else if (key === "b") {
        const next = BASEMAP_ORDER[(BASEMAP_ORDER.indexOf(basemap) + 1) % BASEMAP_ORDER.length];
        setBasemap(next);
        notify(`Basemap: ${BASEMAP_LABELS[next]}`);
      } else if (e.key === "?") {
        openGuide("welcome");
      } else if (e.key === "Escape") {
        if (state.drawing) stopDrawing();
        else if (state.view !== "map") setView("map");
        else if (state.inspectorOpen) selectPoint(null);
        else return;
      } else {
        return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, hasSample, basemap, setView, startDrawing, stopDrawing, retrieveSample, selectPoint, notify, openGuide]);

  return (
    <div className={`workspace${state.inspectorOpen ? " has-inspector" : ""}`}>
      <MapCanvas
        basemapKey={basemap}
        area={state.area}
        drawing={state.drawing}
        points={state.sample?.points ?? []}
        pointColors={pointColors}
        neutralColor={colors.neutral}
        accentColor={colors.accent}
        selectedPointId={state.selectedPointId}
        hoveredPointId={state.hoveredPointId}
        queryPointId={state.queryPointId}
        pinnedIds={state.pinnedIds}
        mapRequest={state.mapRequest}
        describePoint={describePoint}
        onDrawArea={setArea}
        onSelectPoint={selectPoint}
        onHoverPoint={setHoveredPoint}
        onMapReady={setMapInstance}
      />

      <div className="top-row">
        <ControlBar />
        <TopBar
          basemap={basemap}
          onBasemap={setBasemap}
          theme={theme}
          onToggleTheme={toggleTheme}
          onHelp={() => openGuide("welcome")}
        />
      </div>

      <ViewSwitcher active={state.view} disabled={!hasSample} onChange={setView} />

      {state.view !== "map" && (
        <div className="view-overlay">
          <button
            type="button"
            className="view-overlay__close"
            aria-label="Back to map"
            title="Back to map (Esc)"
            onClick={() => setView("map")}
          >
            ✕
          </button>
          {state.view === "embedding" && <EmbeddingView />}
          {state.view === "similarity" && <SimilarityView />}
          {state.view === "analysis" && <AnalysisView />}
        </div>
      )}

      <Inspector />

      <div className="dock-left">
        {hasSample && <ColorPanel />}
        <div className="wordmark">
          Latent Earth
          <span className="wordmark__sub">a laboratory for Earth-observation embeddings</span>
        </div>
      </div>

      <Toast />
      <Guide />
    </div>
  );
}
