import { useCallback, useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "./workspace.tsx";
import { TargetModelProvider } from "./targetModel.tsx";
import { usePointColors } from "./pointColors.ts";
import { formatTargetValue, usePointAnnotations } from "./annotations.ts";
import MapCanvas, { type PointDescription } from "../map/MapCanvas.tsx";
import AppHeader from "../components/layout/AppHeader.tsx";
import WorkflowPanel from "../components/layout/WorkflowPanel.tsx";
import ResultsPanel, { RESULT_TABS } from "../components/layout/ResultsPanel.tsx";
import StatusBar from "../components/layout/StatusBar.tsx";
import type { LayerVisibility } from "../components/layout/LayersSection.tsx";
import MapToolbar, { DrawBanner } from "../components/MapToolbar.tsx";
import MapLegend from "../components/MapLegend.tsx";
import Guide from "../components/Guide.tsx";
import Toast from "../ui/Toast.tsx";
import ErrorBoundary from "../ui/ErrorBoundary.tsx";
import { ThemeProvider, useTheme, THEME_COLORS } from "./theme.tsx";
import { setMapInstance } from "../map/mapHandle.ts";
import { BASEMAP_LABELS, type BasemapKey } from "../map/basemap.ts";

const BASEMAP_ORDER: BasemapKey[] = ["dark", "light", "satellite"];
const GUIDE_SEEN_KEY = "latent-earth:guide-seen";
/** Below this width the side panels become drawers over the map. */
const COMPACT_QUERY = "(max-width: 900px)";

function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return compact;
}

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
  const { state, setArea, selectPoint, setHoveredPoint, setView, startDrawing, stopDrawing, retrieveSample, notify, openGuide, togglePanel } = api;
  const compact = useCompact();
  const [layers, setLayers] = useState<LayerVisibility>({ points: true, area: true });
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

  // Small screens: one drawer at a time, and get out of the way of the map
  // while drawing or right after a sample loads.
  useEffect(() => {
    if (compact) togglePanel("right", false);
  }, [compact, togglePanel]);
  useEffect(() => {
    if (compact && state.drawing) togglePanel("left", false);
  }, [compact, state.drawing, togglePanel]);
  useEffect(() => {
    if (compact && state.sample) {
      togglePanel("left", false);
      togglePanel("right", false);
    }
  }, [compact, state.sample, togglePanel]);
  useEffect(() => {
    if (compact && state.leftPanelOpen) togglePanel("right", false);
    // Only react to the left drawer opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, state.leftPanelOpen]);
  useEffect(() => {
    if (compact && state.rightPanelOpen) togglePanel("left", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, state.rightPanelOpen]);

  // Keyboard shortcuts — ignored while typing in a field or reading the guide.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || state.guide) return;
      const key = e.key.toLowerCase();
      const tab = RESULT_TABS.find((t) => t.key === key);
      if (tab && (hasSample || tab.id === "inspect")) {
        setView(tab.id);
      } else if (key === "[") {
        togglePanel("left");
      } else if (key === "]") {
        togglePanel("right");
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
        else if (state.selectedPointId) selectPoint(null);
        else if (compact && (state.leftPanelOpen || state.rightPanelOpen)) {
          togglePanel("left", false);
          togglePanel("right", false);
        } else return;
      } else {
        return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, hasSample, basemap, compact, setView, startDrawing, stopDrawing, retrieveSample, selectPoint, notify, openGuide, togglePanel]);

  const shellClass = [
    "app",
    state.leftPanelOpen ? "has-left" : "",
    state.rightPanelOpen ? "has-right" : "",
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />

      <aside className="side-panel side-panel--left" aria-label="Workflow and layers" hidden={!state.leftPanelOpen}>
        <WorkflowPanel basemap={basemap} onBasemap={setBasemap} layers={layers} onLayers={setLayers} />
      </aside>

      <main className="map-area" aria-label="Map">
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
          showPoints={layers.points}
          showArea={layers.area}
          mapRequest={state.mapRequest}
          describePoint={describePoint}
          onDrawArea={setArea}
          onSelectPoint={selectPoint}
          onHoverPoint={setHoveredPoint}
          onMapReady={setMapInstance}
        />
        <MapToolbar />
        <DrawBanner />
        <MapLegend />
        <Toast />
        {compact && (state.leftPanelOpen || state.rightPanelOpen) && (
          <button
            type="button"
            className="scrim"
            aria-label="Close panel"
            onClick={() => {
              togglePanel("left", false);
              togglePanel("right", false);
            }}
          />
        )}
      </main>

      <aside className="side-panel side-panel--right" aria-label="Results" hidden={!state.rightPanelOpen}>
        <ResultsPanel />
      </aside>

      <StatusBar />
      <Guide />
    </div>
  );
}
