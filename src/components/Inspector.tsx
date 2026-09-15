import { useWorkspace } from "../app/workspace.tsx";

/** Slide-in detail panel for the selected point. */
export default function Inspector() {
  const { state, selectPoint, setQueryPoint, toggleInspector } = useWorkspace();
  const point = state.sample?.points.find((p) => p.id === state.selectedPointId) ?? null;

  if (!state.inspectorOpen) return null;

  return (
    <aside className="inspector" aria-label="Point inspector">
      <div className="inspector__head">
        <span className="inspector__title">{point ? `Point ${point.id}` : "Inspector"}</span>
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Close inspector" onClick={toggleInspector}>
          ✕
        </button>
      </div>

      {!point ? (
        <p className="popover-copy popover-copy--muted">
          Click a point on the map or in embedding space to inspect it.
        </p>
      ) : (
        <div className="inspector__body">
          <dl className="kv-list">
            <div className="kv">
              <dt>Latitude</dt>
              <dd>{point.lat.toFixed(5)}°</dd>
            </div>
            <div className="kv">
              <dt>Longitude</dt>
              <dd>{point.lon.toFixed(5)}°</dd>
            </div>
            <div className="kv">
              <dt>Source</dt>
              <dd>{state.source?.name ?? "—"}</dd>
            </div>
            <div className="kv">
              <dt>Dimensions</dt>
              <dd>{point.vector.length}</dd>
            </div>
          </dl>

          <div className="block-title">Vector summary</div>
          <VectorStrip vector={point.vector} />

          <div className="inspector__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setQueryPoint(state.queryPointId === point.id ? null : point.id)}
            >
              {state.queryPointId === point.id ? "Remove as query" : "Set as similarity query"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void navigator.clipboard?.writeText(`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`)}
            >
              Copy coordinates
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => selectPoint(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function VectorStrip({ vector }: { vector: Float32Array }) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vector) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const span = Math.max(1e-6, max - min);
  return (
    <div className="vector-strip" role="img" aria-label={`Embedding vector with ${vector.length} dimensions`}>
      {Array.from(vector, (v, i) => (
        <span
          key={i}
          className="vector-strip__cell"
          style={{ opacity: 0.25 + 0.75 * ((v - min) / span) }}
        />
      ))}
    </div>
  );
}