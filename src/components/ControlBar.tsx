import { useSyncExternalStore } from "react";
import type { EmbeddingSource } from "../types/embedding.ts";
import { useWorkspace, type StepId } from "../app/workspace.tsx";
import ControlStepButton from "../ui/ControlStepButton.tsx";
import StepPopover from "../ui/StepPopover.tsx";
import ProgressBar from "../ui/ProgressBar.tsx";
import EarthEngineConnection from "./EarthEngineConnection.tsx";
import AreaPanel from "./AreaPanel.tsx";
import TargetPanel from "./TargetPanel.tsx";
import NextStep from "./NextStep.tsx";
import {
  getEarthEngineProject,
  getEarthEngineStatus,
  NO_PROJECT_MESSAGE,
  subscribeEarthEngine,
} from "../embeddings/gee/connection.ts";

const MAX_SAMPLE = 2000;
const SIZE_PRESETS = [100, 250, 500, 1000, 2000];

/** Sources with no adapter or connection path can't be used yet. */
export function isSelectable(s: EmbeddingSource): boolean {
  return s.status !== "integration-pending" || s.providerConnection !== undefined;
}

export default function ControlBar() {
  const { state, selectSource, startDrawing, stopDrawing, retrieveSample, setSampleSize, setYear, setOpenStep } =
    useWorkspace();
  const { source, sources, area, drawing, status, sample, sampleIsStale, sampleSize, year, target } = state;
  const eeStatus = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const eeProject = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);
  const missingProject = status.kind === "error" && status.message === NO_PROJECT_MESSAGE;

  const { openStep } = state;

  const retrieving = status.kind === "retrieving";
  const canRetrieve = Boolean(source && area) && !retrieving;
  const hasResult = sample !== null;
  const toggle = (step: StepId) => setOpenStep(openStep === step ? null : step);

  function chooseSource(s: EmbeddingSource) {
    selectSource(s);
    // Keep the popover open when the source still needs connecting.
    if (s.providerConnection !== "earth-engine" || eeStatus === "connected") setOpenStep(null);
  }

  function toggleDrawing() {
    if (drawing) {
      stopDrawing();
    } else {
      startDrawing();
      setOpenStep(null);
    }
  }

  function onRetrieve() {
    setOpenStep(null);
    void retrieveSample();
  }

  const years = source?.availableYears;
  const sampleLabel = `${sampleSize.toLocaleString()} pts${years ? ` · ${year ?? years.last}` : ""}`;
  const retrieveTitle = !source
    ? "Choose an embedding source first"
    : !area
      ? "Pick an area first"
      : "Retrieve embeddings for this area (R)";

  return (
    <div className="control-surface" aria-label="Control surface">
      <div className="control-bar">
        <ControlStepButton
          step={1}
          done={!!source}
          icon="⛭"
          label={source ? source.name : "Choose source"}
          active={openStep === "source"}
          emphasized={!source}
          onClick={() => toggle("source")}
        />

        <ControlStepButton
          step={2}
          done={!!area}
          icon="▭"
          label={drawing ? "Drawing…" : area ? "Area set" : "Pick area"}
          active={openStep === "area" || drawing}
          emphasized={!!source && !area && !drawing}
          onClick={() => toggle("area")}
        />

        <div className="control-bar__group">
          <ControlStepButton
            step={3}
            done={hasResult && !sampleIsStale}
            icon="●"
            label={sampleLabel}
            active={openStep === "sample"}
            onClick={() => toggle("sample")}
          />
          <button
            type="button"
            className={`retrieve-btn${canRetrieve && (!hasResult || sampleIsStale) ? " is-ready" : ""}`}
            disabled={!canRetrieve}
            title={retrieveTitle}
            onClick={onRetrieve}
          >
            {retrieving ? "Retrieving…" : hasResult && !sampleIsStale ? "↻ Reload" : "Retrieve ▶"}
          </button>
        </div>

        <span className="control-bar__divider" aria-hidden />

        <ControlStepButton
          icon="◎"
          label={target ? target.name : "+ Target"}
          secondary
          done={!!target}
          active={openStep === "target"}
          onClick={() => toggle("target")}
        />
      </div>

      <NextStep
        eeStatus={eeStatus}
        onOpenStep={setOpenStep}
        onToggleDrawing={toggleDrawing}
      />

      {retrieving && (
        <ProgressBar label={status.kind === "retrieving" ? `Retrieving ${status.requested.toLocaleString()} points…` : undefined} />
      )}

      {status.kind === "zero-results" && (
        <div className="message message--empty" role="status">
          No embeddings found in this area for {source?.name}. Try a larger area, another year, or a
          different source.
        </div>
      )}

      {status.kind === "error" && !(missingProject && eeProject) && (
        <div className="message message--error" role="alert">
          <span>{status.message}</span>
          {missingProject ? (
            <button type="button" className="btn btn--primary btn--small" onClick={() => setOpenStep("source")}>
              Enter project ID
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--small" onClick={onRetrieve} disabled={!canRetrieve}>
              {source?.providerConnection === "earth-engine" && eeStatus !== "connected" ? "Sign in & retry" : "Retry"}
            </button>
          )}
        </div>
      )}

      {openStep === "source" && (
        <StepPopover title="1 · Embedding source" open onClose={() => setOpenStep(null)}>
          <ul className="source-list">
            {sources.map((s) => {
              const selectable = isSelectable(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`source-item${source?.id === s.id ? " is-selected" : ""}`}
                    onClick={() => chooseSource(s)}
                    disabled={!selectable}
                  >
                    <span className="source-item__name">
                      {s.name}
                      {!selectable && <span className="badge badge--pending">Coming soon</span>}
                      {s.status === "mock-only" && <span className="badge badge--dev">Dev-only mock</span>}
                      {s.providerConnection === "earth-engine" && eeStatus === "connected" && (
                        <span className="badge badge--ok">Connected</span>
                      )}
                    </span>
                    <span className="source-item__meta">
                      {s.dimensions} dims · {s.spatialResolution} m · {s.temporalCoverage}
                    </span>
                    <span className="source-item__desc">{s.description}</span>
                  </button>
                  {source?.id === s.id && s.providerConnection === "earth-engine" && (
                    <EarthEngineConnection />
                  )}
                </li>
              );
            })}
          </ul>
        </StepPopover>
      )}

      {openStep === "area" && (
        <StepPopover title="2 · Area of interest" open onClose={() => setOpenStep(null)}>
          <AreaPanel drawing={drawing} onToggleDrawing={toggleDrawing} onDone={() => setOpenStep(null)} />
        </StepPopover>
      )}

      {openStep === "sample" && (
        <StepPopover title="3 · Sample" open onClose={() => setOpenStep(null)}>
          <label className="field">
            <span className="field__label">
              Number of points <span className="field__value">{sampleSize.toLocaleString()}</span>
            </span>
            <input
              type="range"
              min={50}
              max={MAX_SAMPLE}
              step={50}
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              disabled={retrieving}
            />
          </label>
          <div className="chip-row">
            {SIZE_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${sampleSize === n ? " is-active" : ""}`}
                onClick={() => setSampleSize(n)}
                disabled={retrieving}
              >
                {n.toLocaleString()}
              </button>
            ))}
          </div>
          <p className="popover-copy popover-copy--muted">
            Points are spread on an even grid across your area. More points show more detail but take
            longer to load.
          </p>

          {years && (
            <label className="field">
              <span className="field__label">Year</span>
              <select
                className="select"
                value={year ?? ""}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                disabled={retrieving}
              >
                <option value="">Latest ({years.last})</option>
                {Array.from({ length: years.last - years.first + 1 }, (_, i) => years.last - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button type="button" className="btn btn--primary btn--block" disabled={!canRetrieve} onClick={onRetrieve}>
            {retrieving ? "Retrieving…" : hasResult ? "Retrieve again" : "Retrieve sample"}
          </button>
          {!source && <p className="popover-copy popover-copy--muted">Choose an embedding source first.</p>}
          {source && !area && <p className="popover-copy popover-copy--muted">Pick an area on the map first.</p>}
          {hasResult && (
            <p className="popover-copy popover-copy--muted">
              {sample!.points.length.toLocaleString()} of {sample!.requested.toLocaleString()} points loaded.
              {sample!.points.length < sample!.requested &&
                " Some grid cells had no data for this source (e.g. water or no coverage)."}
            </p>
          )}
        </StepPopover>
      )}

      {openStep === "target" && (
        <StepPopover title="Target (optional)" open onClose={() => setOpenStep(null)} wide>
          <TargetPanel />
        </StepPopover>
      )}
    </div>
  );
}
