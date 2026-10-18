import { useMemo, useState } from "react";
import { useWorkspace, MAX_PINNED } from "../app/workspace.tsx";
import { useTargetModel } from "../app/targetModel.tsx";
import { formatTargetValue, usePointAnnotations } from "../app/annotations.ts";
import { cosineSimilarity } from "../analysis/similarity.ts";
import { categorical } from "../visualization/colors.ts";
import type { EmbeddingPoint } from "../types/embedding.ts";

/** Slide-in detail panel for the selected point. */
export default function Inspector() {
  const { state, selectPoint, setQueryPoint, toggleInspector, togglePin, flyToPoint, labelPoint, notify } =
    useWorkspace();
  const annotations = usePointAnnotations();
  const model = useTargetModel();
  const [showVector, setShowVector] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const point = state.sample?.points.find((p) => p.id === state.selectedPointId) ?? null;

  const pinned = useMemo(
    () =>
      state.pinnedIds
        .map((id) => state.sample?.points.find((p) => p.id === id))
        .filter((p): p is EmbeddingPoint => Boolean(p)),
    [state.pinnedIds, state.sample],
  );

  if (!state.inspectorOpen) return null;

  const isQuery = point && state.queryPointId === point.id;
  const isPinned = point && state.pinnedIds.includes(point.id);
  const cluster = point ? annotations.cluster?.get(point.id) : undefined;
  const similarity = point ? annotations.similarity?.get(point.id) : undefined;
  const actual = point ? model?.match.byPoint.get(point.id) : undefined;
  const predicted = point ? annotations.predicted?.get(point.id) : undefined;
  const canLabel = !state.target || state.target.kind === "label";
  const existingLabels = model?.kind === "label" ? model.classes : [];

  function applyLabel(label: string) {
    if (!point) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    labelPoint(point.id, trimmed);
    setLabelDraft("");
    notify(`Labeled ${point.id} as “${trimmed}”`);
  }

  return (
    <aside className="inspector" aria-label="Point inspector">
      <div className="inspector__head">
        <span className="inspector__title">{point ? point.id : "Inspector"}</span>
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
          <div className="inspector__actions">
            <button
              type="button"
              className={`btn ${isQuery ? "" : "btn--primary"}`}
              onClick={() => setQueryPoint(isQuery ? null : point.id)}
              title="Color every point by how similar its embedding is to this one"
            >
              {isQuery ? "Stop comparing" : "◎ Find similar places"}
            </button>
            <button type="button" className="btn" onClick={() => flyToPoint(point.id)}>
              Zoom to
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => togglePin(point.id)}
              title={`Pin up to ${MAX_PINNED} points to compare them`}
            >
              {isPinned ? "Unpin" : "📌 Pin"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(`${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);
                notify("Coordinates copied");
              }}
            >
              Copy coords
            </button>
          </div>

          <dl className="kv-list">
            <KV label="Latitude" value={`${point.lat.toFixed(5)}°`} />
            <KV label="Longitude" value={`${point.lon.toFixed(5)}°`} />
            {point.date && <KV label="Year" value={point.date} />}
            <KV label="Source" value={state.source?.name ?? "—"} />
            {cluster !== undefined && (
              <KV
                label="Cluster"
                value={
                  <>
                    <span className="legend__swatch" style={{ background: categorical(cluster) }} /> {cluster + 1}
                  </>
                }
              />
            )}
            {similarity !== undefined && !isQuery && <KV label="Similarity to query" value={similarity.toFixed(3)} />}
            {actual && <KV label="Target (real)" value={formatTargetValue(actual.label ?? actual.value)} />}
            {!actual && predicted !== undefined && <KV label="Target (predicted)" value={formatTargetValue(predicted)} />}
          </dl>

          {canLabel && (
            <div className="label-box">
              <div className="block-title">Label this point</div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyLabel(labelDraft);
                }}
              >
                <input
                  className="input"
                  placeholder={actual?.label ? `Currently “${actual.label}”` : "e.g. forest, water, urban"}
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  aria-label="Label"
                />
                <button type="submit" className="btn" disabled={!labelDraft.trim()}>
                  Save
                </button>
              </form>
              {(existingLabels.length > 0 || actual?.label) && (
                <div className="chip-row">
                  {existingLabels.map((l, i) => (
                    <button
                      key={l}
                      type="button"
                      className={`chip${actual?.label === l ? " is-active" : ""}`}
                      onClick={() => applyLabel(l)}
                    >
                      <span className="legend__swatch" style={{ background: categorical(i) }} />
                      {l}
                    </button>
                  ))}
                  {actual?.label && state.target?.origin === "manual" && (
                    <button type="button" className="chip" onClick={() => labelPoint(point.id, null)}>
                      ✕ remove label
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="block-title">
            Embedding · {point.vector.length} dims
            <button type="button" className="link-btn" onClick={() => setShowVector((v) => !v)}>
              {showVector ? "hide values" : "show values"}
            </button>
          </div>
          <VectorStrip vector={point.vector} />
          {showVector && (
            <pre className="vector-values">
              {Array.from(point.vector, (v, i) => `${String(i).padStart(2, "0")}  ${v.toFixed(4)}`).join("\n")}
            </pre>
          )}
        </div>
      )}

      {pinned.length > 0 && (
        <div className="compare-tray">
          <div className="block-title">
            Pinned · {pinned.length}/{MAX_PINNED}
          </div>
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                {pinned.map((p, i) => (
                  <th key={p.id} title={p.id}>
                    #{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pinned.map((a, i) => (
                <tr key={a.id}>
                  <th>
                    <button type="button" className="link-btn" onClick={() => selectPoint(a.id)} title={a.id}>
                      #{i + 1}
                    </button>
                  </th>
                  {pinned.map((b) => {
                    const s = cosineSimilarity(a.vector, b.vector);
                    return (
                      <td key={b.id} style={{ opacity: a.id === b.id ? 0.35 : 0.45 + 0.55 * Math.max(0, s) }}>
                        {s.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="popover-copy popover-copy--muted">Cosine similarity between pinned points (1 = identical).</p>
          <ul className="rank-list">
            {pinned.map((p, i) => (
              <li key={p.id} className="pinned-row">
                <button type="button" className="rank-list__item" onClick={() => flyToPoint(p.id)}>
                  <span className="rank-list__id">
                    #{i + 1} {p.id}
                  </span>
                  <span className="rank-list__val">
                    {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                  </span>
                </button>
                <button type="button" className="btn btn--ghost btn--icon" aria-label={`Unpin ${p.id}`} onClick={() => togglePin(p.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
          title={`dim ${i}: ${v.toFixed(4)}`}
          style={{ opacity: 0.2 + 0.8 * ((v - min) / span) }}
        />
      ))}
    </div>
  );
}
