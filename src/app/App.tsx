import { useState } from "react";
import { WorkspaceProvider, useWorkspace } from "./workspace.tsx";
import { usePointColors } from "./pointColors.ts";
import MapCanvas from "../map/MapCanvas.tsx";
import ControlBar from "../components/ControlBar.tsx";
import ViewSwitcher from "../ui/ViewSwitcher.tsx";
import Inspector from "../components/Inspector.tsx";
import EmbeddingView from "../components/views/EmbeddingView.tsx";
import SimilarityView from "../components/views/SimilarityView.tsx";
import AnalysisView from "../components/views/AnalysisView.tsx";
import { NEUTRAL_POINT, viridis, categorical } from "../visualization/colors.ts";
import type { BasemapKey } from "../map/basemap.ts";

export default function App() {
  return (
    <WorkspaceProvider>
      <Workspace />
    </WorkspaceProvider>
  );
}

function Workspace() {
  const { state, setArea, selectPoint, setHoveredPoint, setView } = useWorkspace();
  const pointColors = usePointColors();
  const [basemap, setBasemap] = useState<BasemapKey>("dark");
  const hasSample = state.sample !== null;

  return (
    <div className="workspace">
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
        onDrawArea={setArea}
        onSelectPoint={selectPoint}
        onHoverPoint={setHoveredPoint}
      />

      <ControlBar />

      <ViewSwitcher active={state.view} disabled={!hasSample} onChange={setView} />

      {state.view !== "map" && (
        <div className="view-overlay">
          {state.view === "embedding" && <EmbeddingView />}
          {state.view === "similarity" && <SimilarityView />}
          {state.view === "analysis" && <AnalysisView />}
        </div>
      )}

      <Inspector />

      {pointColors && state.colorBasis !== "neutral" && (
        <Legend basis={state.colorBasis} />
      )}

      <button
        type="button"
        className="basemap-toggle"
        title="Toggle light/dark basemap"
        onClick={() => setBasemap((b) => (b === "dark" ? "light" : "dark"))}
      >
        {basemap === "dark" ? "☀" : "☾"}
      </button>

      <div className="wordmark">
        Latent Earth
        <span className="wordmark__sub">a laboratory for Earth-observation embeddings</span>
      </div>
    </div>
  );
}

function Legend({ basis }: { basis: "cluster" | "similarity" | "neutral" }) {
  const { state } = useWorkspace();

  if (basis === "similarity") {
    const stops = [0, 0.25, 0.5, 0.75, 1];
    return (
      <div className="legend">
        <span className="legend__title">Similarity</span>
        <div className="legend__gradient legend__gradient--sim">
          {stops.map((t) => (
            <span key={t} style={{ background: viridis(t) }} />
          ))}
        </div>
        <span className="legend__scale legend__scale--sim">−1 ... +1</span>
      </div>
    );
  }

  if (basis === "cluster" && state.clusters) {
    const sizes: Record<number, number> = {};
    state.clusters.assignments.forEach((a) => {
      sizes[a] = (sizes[a] ?? 0) + 1;
    });
    return (
      <div className="legend">
        <span className="legend__title">Clusters (k={state.clusters.k})</span>
        <ul className="legend__list">
          {Object.entries(sizes).map(([c, n]) => (
            <li key={c} className="legend__item">
              <span
                className="legend__swatch"
                style={{ background: categorical(Number(c)) }}
              />
              cluster {Number(c) + 1} · {n} pts
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}