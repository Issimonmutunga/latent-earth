import { useState } from "react";
import type { EmbeddingSource } from "../types/embedding.ts";
import { useWorkspace } from "../app/workspace.tsx";
import ControlStepButton from "../ui/ControlStepButton.tsx";
import StepPopover from "../ui/StepPopover.tsx";
import ProgressBar from "../ui/ProgressBar.tsx";
import EarthEngineConnection from "./EarthEngineConnection.tsx";

const MAX_SAMPLE = 2000;

export default function ControlBar() {
  const { state, selectSource, startDrawing, stopDrawing, retrieveSample } = useWorkspace();
  const {
    source,
    sources,
    area,
    drawing,
    status,
    sample,
    sampleIsStale,
  } = state;

  const [openStep, setOpenStep] = useState<"source" | "area" | "sample" | "target" | null>(null);
  const [sampleSize, setSampleSize] = useState(500);

  const canRetrieve = Boolean(source && area) && status.kind !== "retrieving";
  const hasResult = sample !== null;
  const retrieving = status.kind === "retrieving";
  const empty = !source;

  function chooseSource(s: EmbeddingSource) {
    selectSource(s);
    setOpenStep(null);
  }

  function toggleArea() {
    if (drawing) {
      stopDrawing();
      setOpenStep(null);
    } else {
      startDrawing();
      setOpenStep("area");
    }
  }

  function onRetrieve() {
    if (!source || !area) return;
    void retrieveSample(sampleSize);
  }

  const areaLabel = area
    ? `bbox ${area.west.toFixed(2)}°, ${area.south.toFixed(2)}° → ${area.east.toFixed(2)}°, ${area.north.toFixed(2)}°`
    : "";

  return (
    <div className="control-surface" aria-label="Control surface">
      <div className="control-bar">
        <ControlStepButton
          icon="⛭"
          label={source ? source.name : "Source"}
          active={!!source}
          emphasized={empty}
          disabled={false}
          onClick={() => setOpenStep(openStep === "source" ? null : "source")}
        />

        <ControlStepButton
          icon="▭"
          label={area ? "Area set" : "Draw area"}
          active={drawing || !!area}
          onClick={toggleArea}
        />

        <ControlStepButton
          icon="●"
          label={
            retrieving
              ? "Retrieving…"
              : hasResult
                ? `${sample!.points.length.toLocaleString()} pts loaded`
                : "Sample: 500"
          }
          active={hasResult}
          onClick={() => setOpenStep(openStep === "sample" ? null : "sample")}
        />

        <span className="control-bar__divider" aria-hidden />

        <ControlStepButton
          icon="◎ +"
          label="Add target"
          active={!!state.target}
          onClick={() => setOpenStep(openStep === "target" ? null : "target")}
        />
      </div>

      {sampleIsStale && (
        <div className="stale-banner" role="status">
          Sample is out of date — retrieve again to reflect your changes.
        </div>
      )}

      {retrieving && (
        <ProgressBar label={status.kind === "retrieving" ? `Retrieving ${status.requested} points…` : undefined} />
      )}

      {status.kind === "zero-results" && (
        <div className="message message--empty" role="status">
          No embeddings found in this area for {source?.name}. Try widening the area or choosing a
          different source.
        </div>
      )}

      {status.kind === "error" && (
        <div className="message message--error" role="alert">
          <span>{status.message}</span>
          <button type="button" className="btn btn--ghost" onClick={onRetrieve}>
            Retry
          </button>
        </div>
      )}

      {openStep === "source" && (
        <StepPopover title="Embedding source" open onClose={() => setOpenStep(null)}>
          <ul className="source-list">
            {sources.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`source-item${source?.id === s.id ? " is-selected" : ""}`}
                  onClick={() => chooseSource(s)}
                >
                  <span className="source-item__name">{s.name}</span>
                  <span className="source-item__meta">
                    {s.dimensions} dims · {s.spatialResolution} m · {s.temporalCoverage}
                    {s.status === "integration-pending" && (
                      <span className="badge badge--pending">Integration pending</span>
                    )}
                    {s.status === "mock-only" && (
                      <span className="badge badge--dev">Dev-only mock</span>
                    )}
                  </span>
                  <span className="source-item__desc">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
          {source?.providerConnection === "earth-engine" && <EarthEngineConnection />}
        </StepPopover>
      )}

      {openStep === "area" && (
        <StepPopover title="Area" open onClose={() => setOpenStep(null)}>
          <p className="popover-copy">
            {drawing ? "Drag on the map to draw a bounding box." : "Draw an area, or paste bounds."}
          </p>
          {area && (
            <p className="popover-copy popover-copy--mono">
              {area.west.toFixed(3)}, {area.south.toFixed(3)} → {area.east.toFixed(3)},{" "}
              {area.north.toFixed(3)}
            </p>
          )}
        </StepPopover>
      )}

      {openStep === "sample" && (
        <StepPopover title="Sample" open onClose={() => setOpenStep(null)}>
          <label className="field">
            <span className="field__label">
              Sample size <span className="field__value">{sampleSize}</span>
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
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canRetrieve}
            onClick={onRetrieve}
          >
            {retrieving ? "Retrieving…" : hasResult ? "Re-retrieve" : "Retrieve sample"}
          </button>
          {!source && <p className="popover-copy">Choose an embedding source first.</p>}
          {source && !area && <p className="popover-copy">Draw an area on the map first.</p>}
          {hasResult && (
            <p className="popover-copy popover-copy--muted">
              {sample!.points.length} of {sample!.requested} points loaded.
              {areaLabel ? ` Area: ${areaLabel}.` : ""}
            </p>
          )}
        </StepPopover>
      )}

      {openStep === "target" && (
        <StepPopover title="Target (optional)" open onClose={() => setOpenStep(null)}>
          <p className="popover-copy">What are you looking for signal of?</p>
          <p className="popover-copy popover-copy--muted">
            Real targets only — upload labeled points or a ground-truth file (CSV/GeoJSON). Target
            upload arrives in a later phase; no synthetic targets are ever offered.
          </p>
        </StepPopover>
      )}
    </div>
  );
}