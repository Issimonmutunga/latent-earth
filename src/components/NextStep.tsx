import { useState } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import { getViewBounds } from "../map/mapHandle.ts";
import { signInEarthEngine, type EarthEngineStatus } from "../embeddings/gee/connection.ts";
import type { StepId } from "../app/workspace.tsx";

interface NextStepProps {
  eeStatus: EarthEngineStatus;
  onOpenStep: (step: StepId) => void;
  onToggleDrawing: () => void;
}

/**
 * A single line under the control bar that always says what to do next,
 * with the button that does it.
 */
export default function NextStep({ eeStatus, onOpenStep, onToggleDrawing }: NextStepProps) {
  const { state, retrieveSample, setArea, runClustering, setView, notify } = useWorkspace();
  const { source, area, drawing, sample, sampleIsStale, status, sampleSize, clusters, view } = state;
  const [dismissedExplore, setDismissedExplore] = useState(false);

  if (status.kind === "retrieving") return null;

  let text: React.ReactNode = null;
  let actions: React.ReactNode = null;
  let dismissible = false;

  if (drawing) {
    text = (
      <>
        <strong>Click and drag</strong> on the map to draw your area.
      </>
    );
    actions = (
      <button type="button" className="btn btn--small" onClick={onToggleDrawing}>
        Cancel <kbd>Esc</kbd>
      </button>
    );
  } else if (!source) {
    text = "Start by choosing an embedding source.";
    actions = (
      <button type="button" className="btn btn--primary btn--small" onClick={() => onOpenStep("source")}>
        Choose source
      </button>
    );
  } else if (source.providerConnection === "earth-engine" && eeStatus === "not-configured") {
    text = `${source.name} needs Google Earth Engine credentials configured for this deployment.`;
    actions = (
      <button type="button" className="btn btn--small" onClick={() => onOpenStep("source")}>
        How to set up
      </button>
    );
  } else if (source.providerConnection === "earth-engine" && eeStatus === "auth-pending") {
    text = `Sign in with Google to let ${source.name} read Earth Engine data.`;
    actions = (
      <button
        type="button"
        className="btn btn--primary btn--small"
        onClick={() => void signInEarthEngine().catch(() => {})}
      >
        Sign in with Google
      </button>
    );
  } else if (!area) {
    text = "Now pick an area: draw a box, search for a place, or use what's on screen.";
    actions = (
      <>
        <button type="button" className="btn btn--primary btn--small" onClick={onToggleDrawing}>
          ✎ Draw <kbd>D</kbd>
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const b = getViewBounds();
            if (b) {
              setArea(b);
              notify("Area set to the current map view");
            }
          }}
        >
          Use current view
        </button>
        <button type="button" className="btn btn--small" onClick={() => onOpenStep("area")}>
          Search…
        </button>
      </>
    );
  } else if (!sample || sampleIsStale) {
    text = sampleIsStale
      ? "Your settings changed since the last retrieval."
      : `Ready — retrieve ${sampleSize.toLocaleString()} embeddings from this area.`;
    actions = (
      <>
        <button type="button" className="btn btn--primary btn--small" onClick={() => void retrieveSample()}>
          {sampleIsStale ? "Retrieve again" : "Retrieve"} <kbd>R</kbd>
        </button>
        <button type="button" className="btn btn--small" onClick={() => onOpenStep("sample")}>
          Adjust
        </button>
      </>
    );
  } else if (!dismissedExplore && view === "map" && !clusters && !state.queryPointId) {
    dismissible = true;
    text = (
      <>
        <strong>{sample.points.length.toLocaleString()} points loaded.</strong> Hover or click a point to
        inspect it, or let the app find natural groupings.
      </>
    );
    actions = (
      <>
        <button type="button" className="btn btn--primary btn--small" onClick={() => runClustering(4)}>
          Find clusters
        </button>
        <button type="button" className="btn btn--small" onClick={() => setView("embedding")}>
          Embedding view <kbd>2</kbd>
        </button>
      </>
    );
  }

  if (!text) return null;

  return (
    <div className="next-step" role="status">
      <span className="next-step__text">{text}</span>
      <span className="next-step__actions">{actions}</span>
      {dismissible && (
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Dismiss tip"
          onClick={() => setDismissedExplore(true)}
        >
          ✕
        </button>
      )}
    </div>
  );
}
