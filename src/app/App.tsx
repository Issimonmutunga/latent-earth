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
import Toast from "../ui/Toast.tsx";
import EmbeddingView from "../components/views/EmbeddingView.tsx";
import SimilarityView from "../components/views/SimilarityView.tsx";
import AnalysisView from "../components/views/AnalysisView.tsx";
import { NEUTRAL_POINT } from "../visualization/colors.ts";
import { setMapInstance } from "../map/mapHandle.ts";
import { BASEMAP_LABELS, type BasemapKey } from "../map/basemap.ts";
import type { ViewMode } from "../types/embedding.ts";

const BASEMAP_ORDER: BasemapKey[] = ["dark", "light", "satellite"];
const VIEW_KEYS: Record<string, ViewMode> = { "1": "map", "2": "embedding", "3": "similarity", "4": "analysis" };

export default function App() {
  return (
    <WorkspaceProvider>
      <TargetModelProvider>
        <Workspace />
      </TargetModelProvider>
    </WorkspaceProvider>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function Workspace() {
  const api = useWorkspace();
  const { state, setArea, selectPoint, setHoveredPoint, setView, startDrawing, stopDrawing, retrieveSample, notify } = api;
  const pointColors = usePointColors();
  const annotations = usePointAnnotations();
  const [basemap, setBasemap] = useState<BasemapKey>("dark");
  const [helpOpen, setHelpOpen] = useState(false);
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

  // Keyboard shortcuts — ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
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
        setHelpOpen((v) => !v);
      } else if (e.key === "Escape") {
        if (state.drawing) stopDrawing();
        else if (helpOpen) setHelpOpen(false);
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
  }, [state, hasSample, basemap, helpOpen, setView, startDrawing, stopDrawing, retrieveSample, selectPoint, notify]);

  return (
    <div className={`workspace${state.inspectorOpen ? " has-inspector" : ""}`}>
      <MapCanvas
        basemapKey={basemap}
        area={state.area}
        drawing={state.drawing}
        points={state.sample?.points ?? []}
        pointColors={pointColors}
        neutralColor={NEUTRAL_POINT}
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

      <ControlBar />

      <TopBar
        basemap={basemap}
        onBasemap={setBasemap}
        helpOpen={helpOpen}
        onHelp={setHelpOpen}
      />

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
    </div>
  );
}
