import { useSyncExternalStore } from "react";
import type { EmbeddingSource } from "../../types/embedding.ts";
import { useWorkspace, type StepId } from "../../app/workspace.tsx";
import ProgressBar from "../../ui/ProgressBar.tsx";
import EarthEngineConnection from "../EarthEngineConnection.tsx";
import AreaPanel, { formatArea } from "../AreaPanel.tsx";
import TargetPanel from "../TargetPanel.tsx";
import NextStep from "../NextStep.tsx";
import LayersSection, { type LayerVisibility } from "./LayersSection.tsx";
import type { BasemapKey } from "../../map/basemap.ts";
import {
  getEarthEngineProject,
  getEarthEngineStatus,
  NO_PROJECT_MESSAGE,
  subscribeEarthEngine,
} from "../../embeddings/gee/connection.ts";

const MAX_SAMPLE = 2000;
const SIZE_PRESETS = [100, 250, 500, 1000, 2000];

/** Sources with no adapter or connection path can't be used yet. */
export function isSelectable(s: EmbeddingSource): boolean {
  return s.status !== "integration-pending" || s.providerConnection !== undefined;
}

interface StepProps {
  id: StepId;
  badge: string;
  title: string;
  summary: React.ReactNode;
  done: boolean;
  optional?: boolean;
  children: React.ReactNode;
}

function Step({ id, badge, title, summary, done, optional, children }: StepProps) {
  const { state, setOpenStep } = useWorkspace();
  const open = state.openStep === id;
  return (
    <section className={`wf-step${open ? " is-open" : ""}${done ? " is-done" : ""}${optional ? " is-optional" : ""}`}>
      <button
        type="button"
        className="wf-step__head"
        aria-expanded={open}
        onClick={() => setOpenStep(open ? null : id)}
      >
        <span className="wf-step__badge" aria-hidden>
          {done ? "✓" : badge}
        </span>
        <span className="wf-step__titles">
          <span className="wf-step__title">
            {title}
            {optional && <span className="wf-step__optional">optional</span>}
          </span>
          {!open && <span className="wf-step__summary">{summary}</span>}
        </span>
        <span className="wf-step__chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="wf-step__body">{children}</div>}
    </section>
  );
}

interface WorkflowPanelProps {
  basemap: BasemapKey;
  onBasemap: (key: BasemapKey) => void;
  layers: LayerVisibility;
  onLayers: (layers: LayerVisibility) => void;
}

/** Left panel: the guided workflow on top, map layers underneath. */
export default function WorkflowPanel({ basemap, onBasemap, layers, onLayers }: WorkflowPanelProps) {
  const { state, selectSource, startDrawing, stopDrawing, retrieveSample, setSampleSize, setYear, setOpenStep } =
    useWorkspace();
  const { source, sources, area, drawing, status, sample, sampleIsStale, sampleSize, year, target } = state;
  const eeStatus = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const eeProject = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);

  const retrieving = status.kind === "retrieving";
  const canRetrieve = Boolean(source && area) && !retrieving;
  const hasResult = sample !== null;
  const years = source?.availableYears;
  const needsProject = source?.providerConnection === "earth-engine" && !eeProject;
  const sourceReady = Boolean(source) && !needsProject;
  const missingProject = status.kind === "error" && status.message === NO_PROJECT_MESSAGE;

  function toggleDrawing() {
    if (drawing) stopDrawing();
    else startDrawing();
  }

  const retrieveLabel = retrieving
    ? "Retrieving…"
    : source?.providerConnection === "earth-engine" && eeStatus !== "connected"
      ? "Sign in & retrieve"
      : hasResult && !sampleIsStale
        ? "Retrieve again"
        : "Retrieve sample";

  return (
    <div className="panel-scroll">
      <NextStep eeStatus={eeStatus} onOpenStep={setOpenStep} onToggleDrawing={toggleDrawing} />

      <div className="panel-heading">Workflow</div>

      <Step
        id="source"
        badge="1"
        title="Data source"
        done={sourceReady}
        summary={
          source
            ? `${source.name}${source.providerConnection === "earth-engine" ? (needsProject ? " · needs project" : ` · ${eeProject}`) : ""}`
            : "Choose an embedding model"
        }
      >
        <ul className="source-list">
          {sources.map((s) => {
            const selectable = isSelectable(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`source-item${source?.id === s.id ? " is-selected" : ""}`}
                  onClick={() => selectSource(s)}
                  disabled={!selectable}
                  aria-pressed={source?.id === s.id}
                >
                  <span className="source-item__radio" aria-hidden />
                  <span className="source-item__text">
                    <span className="source-item__name">
                      {s.name}
                      {!selectable && <span className="badge badge--pending">Coming soon</span>}
                      {s.status === "mock-only" && <span className="badge badge--dev">Dev only</span>}
                    </span>
                    <span className="source-item__meta">
                      {s.dimensions} dims · {s.spatialResolution} m · {s.temporalCoverage}
                    </span>
                    {source?.id === s.id && <span className="source-item__desc">{s.description}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {source?.providerConnection === "earth-engine" && <EarthEngineConnection />}
        {source && sourceReady && (
          <button type="button" className="btn btn--primary btn--block" onClick={() => setOpenStep("area")}>
            Next: pick an area →
          </button>
        )}
      </Step>

      <Step
        id="area"
        badge="2"
        title="Area of interest"
        done={Boolean(area)}
        summary={drawing ? "Drawing on the map…" : area ? formatArea(area) : "Draw, search or use the view"}
      >
        <AreaPanel drawing={drawing} onToggleDrawing={toggleDrawing} onDone={() => {}} />
      </Step>

      <Step
        id="sample"
        badge="3"
        title="Sample & retrieve"
        done={hasResult && !sampleIsStale}
        summary={
          hasResult
            ? `${sample!.points.length.toLocaleString()} points loaded${sampleIsStale ? " · out of date" : ""}`
            : `${sampleSize.toLocaleString()} points${years ? ` · ${year ?? years.last}` : ""}`
        }
      >
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
        <p className="popover-copy popover-copy--muted">
          Points are spread on an even grid over your area. More points show more detail but take longer.
        </p>

        <button
          type="button"
          className="btn btn--primary btn--block btn--large"
          disabled={!canRetrieve}
          onClick={() => void retrieveSample()}
        >
          {retrieveLabel} <kbd>R</kbd>
        </button>
        {!source && <p className="popover-copy popover-copy--muted">Choose a data source first.</p>}
        {source && !area && <p className="popover-copy popover-copy--muted">Pick an area first.</p>}

        {retrieving && status.kind === "retrieving" && (
          <ProgressBar label={`Retrieving ${status.requested.toLocaleString()} points…`} />
        )}
        {status.kind === "zero-results" && (
          <div className="message message--empty" role="status">
            No embeddings found here for {source?.name}. Try a larger area, another year, or another source.
          </div>
        )}
        {status.kind === "error" && !(missingProject && eeProject) && (
          <div className="message message--error" role="alert">
            <span>{status.message}</span>
            {missingProject ? (
              <button type="button" className="btn btn--small" onClick={() => setOpenStep("source")}>
                Enter project ID
              </button>
            ) : (
              <button type="button" className="btn btn--small" onClick={() => void retrieveSample()} disabled={!canRetrieve}>
                Retry
              </button>
            )}
          </div>
        )}
        {hasResult && (
          <p className="popover-copy popover-copy--muted">
            {sample!.points.length.toLocaleString()} of {sample!.requested.toLocaleString()} points loaded.
            {sample!.points.length < sample!.requested &&
              " Some grid cells had no data (e.g. water or no coverage)."}
          </p>
        )}
      </Step>

      <Step
        id="target"
        badge="+"
        title="Ground truth"
        optional
        done={Boolean(target)}
        summary={target ? `${target.name} · ${target.rows.length} rows` : "Test the embedding against real data"}
      >
        <TargetPanel />
      </Step>

      <LayersSection basemap={basemap} onBasemap={onBasemap} layers={layers} onLayers={onLayers} />
    </div>
  );
}
