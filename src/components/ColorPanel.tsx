import { useWorkspace, type ColorBasis } from "../app/workspace.tsx";
import { useTargetModel } from "../app/targetModel.tsx";
import { categorical, viridis } from "../visualization/colors.ts";

const OPTIONS: Array<{ basis: ColorBasis; label: string }> = [
  { basis: "neutral", label: "Plain" },
  { basis: "cluster", label: "Clusters" },
  { basis: "similarity", label: "Similarity" },
  { basis: "target", label: "Target" },
];

const DEFAULT_K = 4;
const GRADIENT_STOPS = [0, 0.25, 0.5, 0.75, 1];

/** "Color points by" switch plus the legend for whatever is active. */
export default function ColorPanel() {
  const { state, setColorBasis, runClustering, setQueryPoint, selectPoint } = useWorkspace();
  const model = useTargetModel();
  const { colorBasis, clusters, queryPointId, sample } = state;

  function choose(basis: ColorBasis) {
    if (basis === "cluster" && !clusters) {
      runClustering(DEFAULT_K);
      return;
    }
    setColorBasis(basis);
  }

  const reason: Partial<Record<ColorBasis, string>> = {
    similarity: queryPointId ? undefined : "Click a point and choose “Find similar” first",
    target: model?.predicted ? undefined : "Attach a target or label a few points first",
  };

  return (
    <div className="color-panel">
      <div className="color-panel__title">Color points by</div>
      <div className="segmented" role="radiogroup" aria-label="Color points by">
        {OPTIONS.map(({ basis, label }) => (
          <button
            key={basis}
            type="button"
            role="radio"
            aria-checked={colorBasis === basis}
            className={`segmented__item${colorBasis === basis ? " is-active" : ""}`}
            disabled={Boolean(reason[basis])}
            title={reason[basis] ?? (basis === "cluster" && !clusters ? `Run k-means with k=${DEFAULT_K}` : undefined)}
            onClick={() => choose(basis)}
          >
            {label}
          </button>
        ))}
      </div>

      {colorBasis === "cluster" && clusters && (
        <>
          <ul className="legend__list">
            {Array.from({ length: clusters.k }, (_, c) => {
              const n = clusters.assignments.filter((a) => a === c).length;
              return (
                <li key={c} className="legend__item">
                  <span className="legend__swatch" style={{ background: categorical(c) }} />
                  Cluster {c + 1}
                  <span className="legend__count">{n}</span>
                </li>
              );
            })}
          </ul>
          <div className="button-row">
            {[3, 4, 5, 6].map((k) => (
              <button
                key={k}
                type="button"
                className={`chip${clusters.k === k ? " is-active" : ""}`}
                onClick={() => runClustering(k)}
                title={`Re-run k-means with ${k} clusters`}
              >
                k={k}
              </button>
            ))}
          </div>
        </>
      )}

      {colorBasis === "similarity" && queryPointId && (
        <>
          <div className="legend__gradient">
            {GRADIENT_STOPS.map((t) => (
              <span key={t} style={{ background: viridis(t) }} />
            ))}
          </div>
          <div className="legend__scale">
            <span>different</span>
            <span>similar</span>
          </div>
          <div className="button-row">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => selectPoint(queryPointId)}>
              Show query point
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setQueryPoint(null)}>
              Clear
            </button>
          </div>
        </>
      )}

      {colorBasis === "target" && model?.predicted && (
        <>
          {model.kind === "label" ? (
            <ul className="legend__list">
              {model.classes.map((c, i) => (
                <li key={c} className="legend__item">
                  <span className="legend__swatch" style={{ background: categorical(i) }} />
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            model.range && (
              <>
                <div className="legend__gradient">
                  {GRADIENT_STOPS.map((t) => (
                    <span key={t} style={{ background: viridis(t) }} />
                  ))}
                </div>
                <div className="legend__scale">
                  <span>{model.range.min.toPrecision(3)}</span>
                  <span>{model.range.max.toPrecision(3)}</span>
                </div>
              </>
            )
          )}
          <p className="legend__note">
            k-NN prediction from {model.match.byPoint.size} labeled of {sample?.points.length ?? 0} points
          </p>
        </>
      )}
    </div>
  );
}
