import { useMemo, useState } from "react";
import { useWorkspace } from "../../app/workspace.tsx";
import ResultCard from "../../ui/ResultCard.tsx";
import { categorical } from "../../visualization/colors.ts";
import { pca } from "../../analysis/pca.ts";
import { kmeans } from "../../analysis/clustering.ts";

export default function AnalysisView() {
  const { state, setClusters, clearClusters } = useWorkspace();
  const [k, setK] = useState(3);

  const sample = state.sample;

  const pcaResult = useMemo(() => {
    if (!sample || sample.points.length < 2) return null;
    try {
      return pca(sample.points.map((p) => p.vector), Math.min(4, sample.points[0].vector.length));
    } catch {
      return null;
    }
  }, [sample]);

  const clusterResult = useMemo(() => {
    if (!sample || sample.points.length < k) return null;
    try {
      return kmeans(sample.points.map((p) => p.vector), k);
    } catch {
      return null;
    }
  }, [sample, k]);

  if (!sample) {
    return (
      <div className="view-panel view-panel__empty">
        <p>Retrieve a sample to run analyses.</p>
        <p className="popover-copy popover-copy--muted">
          All analyses run locally against the retrieved points.
        </p>
      </div>
    );
  }

  const runClusters = () => {
    if (clusterResult) {
      setClusters({ assignments: clusterResult.assignments, k });
    }
  };

  const n = sample.points.length;
  const sourceName = state.source?.name ?? "unknown source";
  const runFooter = `n = ${n} · ${sourceName} · ${new Date(sample.retrievedAt).toLocaleString()}`;

  return (
    <div className="view-panel view-panel--scroll">
      {pcaResult && (
        <ResultCard
          title="Principal component analysis"
          stat={`${(pcaResult.varianceExplained[0] * 100).toFixed(0)}% variance (PC1)`}
          interpretation="PCA projects the retrieved embeddings onto the directions of greatest variation. Separation in this plot suggests the embedding distinguishes different land states."
          footer={runFooter}
        >
          <div className="bar-chart" role="img" aria-label="Variance explained per component">
            {pcaResult.varianceExplained.map((v, i) => (
              <div key={i} className="bar-chart__item">
                <div className="bar-chart__track">
                  <div
                    className="bar-chart__fill"
                    style={{ height: `${Math.min(100, v * 100)}%` }}
                  />
                </div>
                <span className="bar-chart__label">PC{i + 1}</span>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {sample.points.length < 2 && (
        <ResultCard
          title="Principal component analysis"
          stat="—"
          interpretation="PCA needs at least 2 points with variation; try a larger or more diverse sample."
          footer={runFooter}
        />
      )}

      <ResultCard
        title="K-means clustering"
        stat={clusterResult ? `${k} clusters` : "—"}
        interpretation="Cluster assignments propagate to the map and embedding views as colors — the same color always means the same cluster everywhere."
        footer={`k-means, k=${k}, euclidean, n=${n}`}
      >
        <label className="field">
          <span className="field__label">
            k <span className="field__value">{k}</span>
          </span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>
        {clusterResult && (
          <div className="cluster-sizes" aria-label="Cluster sizes">
            {Array.from({ length: k }, (_, c) => (
              <span key={c} className="cluster-chip">
                <span className="cluster-chip__dot" style={{ background: categorical(c) }} />
                {clusterResult.assignments.filter((a) => a === c).length}
              </span>
            ))}
          </div>
        )}
        <div className="result-actions">
          <button type="button" className="btn btn--primary" onClick={runClusters} disabled={!clusterResult}>
            {state.clusters && state.clusters.k === k ? "Re-run and color views" : "Run clustering"}
          </button>
          {state.clusters && (
            <button type="button" className="btn btn--ghost" onClick={clearClusters}>
              Clear clusters
            </button>
          )}
        </div>
      </ResultCard>

      <ResultCard
        title="Correlation with a target"
        stat="—"
        interpretation="Correlation measures whether any embedding dimensions track a real target variable you supply."
        footer="requires real target labels"
      >
        <p className="popover-copy popover-copy--muted">
          Attach a real target to run correlation. No synthetic targets are ever offered.
        </p>
        <button type="button" className="btn btn--ghost" disabled title="Target upload arrives in a later phase">
          Attach a real target
        </button>
      </ResultCard>

      <ResultCard
        title="Simple classification"
        stat="—"
        interpretation="A small classifier, honestly evaluated, can reveal whether the embedding separates your target classes."
        footer="requires labeled target"
      >
        <p className="popover-copy popover-copy--muted">
          Attach a real labeled target to run classification.
        </p>
      </ResultCard>
    </div>
  );
}