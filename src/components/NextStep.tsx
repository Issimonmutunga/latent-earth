import { useSyncExternalStore } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import { getViewBounds } from "../map/mapHandle.ts";
import { areaKm2 } from "./AreaPanel.tsx";
import {
  getEarthEngineProject,
  signInEarthEngine,
  subscribeEarthEngine,
  type EarthEngineStatus,
} from "../embeddings/gee/connection.ts";
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
  const { state, retrieveSample, setArea, notify, openGuide } = useWorkspace();
  const eeProject = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);
  const { source, area, drawing, sample, sampleIsStale, status, sampleSize } = state;

  if (status.kind === "retrieving") return null;

  let text: React.ReactNode = null;
  let actions: React.ReactNode = null;

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
    text = `Google sign-in isn't set up on this deployment, so ${source.name} can't load yet.`;
    actions = (
      <button type="button" className="btn btn--small" onClick={() => openGuide("troubleshooting")}>
        Details
      </button>
    );
  } else if (source.providerConnection === "earth-engine" && !eeProject) {
    text = (
      <>
        <strong>One-time setup:</strong> enter your free Earth Engine project ID so {source.name} runs on
        your own quota.
      </>
    );
    actions = (
      <>
        <button type="button" className="btn btn--primary btn--small" onClick={() => onOpenStep("source")}>
          Enter project ID
        </button>
        <button type="button" className="btn btn--small" onClick={() => openGuide("setup")}>
          How do I get one?
        </button>
      </>
    );
  } else if (source.providerConnection === "earth-engine" && eeStatus === "auth-pending") {
    text = `One more click: sign in with Google so ${source.name} can read Earth Engine data.`;
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
    const needsSignIn = source.providerConnection === "earth-engine" && eeStatus !== "connected";
    // Grid spacing finer than the source's pixels just samples the same pixel repeatedly.
    const spacingM = Math.sqrt((areaKm2(area) * 1e6) / sampleSize);
    const tooSmall = spacingM < source.spatialResolution;
    text = tooSmall
      ? `This area is tiny: ${sampleSize.toLocaleString()} points would sit ${spacingM < 1 ? "<1" : spacingM.toFixed(0)} m apart, finer than ${source.name}'s ${source.spatialResolution} m pixels, so many would repeat. Draw a larger area or use fewer points.`
      : sampleIsStale
      ? "Your settings changed since the last retrieval."
      : needsSignIn
        ? `Ready — sign in with Google, then ${sampleSize.toLocaleString()} embeddings load from this area.`
        : `Ready — retrieve ${sampleSize.toLocaleString()} embeddings from this area.`;
    actions = (
      <>
        <button type="button" className="btn btn--primary btn--small" onClick={() => void retrieveSample()}>
          {needsSignIn ? "Sign in & retrieve" : sampleIsStale ? "Retrieve again" : tooSmall ? "Retrieve anyway" : "Retrieve"}{" "}
          <kbd>R</kbd>
        </button>
        {tooSmall && (
          <button type="button" className="btn btn--small" onClick={onToggleDrawing}>
            Redraw <kbd>D</kbd>
          </button>
        )}
        <button type="button" className="btn btn--small" onClick={() => onOpenStep("sample")}>
          Adjust
        </button>
      </>
    );
  }

  if (!text) return null;

  return (
    <div className="next-step" role="status">
      <span className="next-step__label">Next step</span>
      <span className="next-step__text">{text}</span>
      <span className="next-step__actions">{actions}</span>
    </div>
  );
}
