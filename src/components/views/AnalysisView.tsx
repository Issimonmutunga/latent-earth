import { useMemo, useState } from "react";
import { useWorkspace } from "../../app/workspace.tsx";
import { useTargetModel, KNN_K } from "../../app/targetModel.tsx";
import ResultCard from "../../ui/ResultCard.tsx";
import { categorical } from "../../visualization/colors.ts";
import { pca } from "../../analysis/pca.ts";
import {
  classifyLeaveOneOut,
  correlateDimensions,
  pearson,
  regressLeaveOneOut,
} from "../../analysis/supervised.ts";

/** Below this many labeled points, results get an explicit small-sample warning. */
const SMALL_N = 30;
const TOP_DIMS = 10;

function strength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.2) return "weak";
  if (a < 0.5) return "moderate";
  return "strong";
}

export default function AnalysisView() {
  const { state, runClustering, clearClusters, setColorBasis, setOpenStep } = useWorkspace();
  const model = useTargetModel();
  const [k, setK] = useState(state.clusters?.k ?? 4);

  const sample = state.sample;

  const pcaResult = useMemo(() => {
    if (!sample || sample.points.length < 2) return null;
    try {
      return pca(sample.points.map((p) => p.vector), Math.min(4, sample.points[0].vector.length));
    } catch {
      return null;
    }
  }, [sample]);

  // Labeled subset of the sample, in sample order.
  const labeled = useMemo(() => {
    if (!sample || !model) return null;
    const idx: number[] = [];
    sample.points.forEach((p, i) => {
      if (model.match.byPoint.has(p.id)) idx.push(i);
    });
    return idx;
  }, [sample, model]);

  const supervised = useMemo(() => {
    if (!sample || !model || !labeled || labeled.length < 4) return null;
    const vectors = labeled.map((i) => sample.points[i].vector);
    const truth = labeled.map((i) => model.match.byPoint.get(sample.points[i].id)!);
    if (model.kind === "label") {
      const labels = truth.map((t) => t.label!);
      if (new Set(labels).size < 2) return null;
      return { kind: "label" as const, report: classifyLeaveOneOut(vectors, labels, KNN_K) };
    }
    const values = truth.map((t) => t.value!);
    const dims = correlateDimensions(vectors, values);
    const top = dims
      .map((r, d) => ({ d, r }))
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, TOP_DIMS);
    const components = pcaResult
      ? pcaResult.varianceExplained.map((_, c) =>
          pearson(
            labeled.map((i) => pcaResult.scores[i][c]),
            values,
          ),
        )
      : [];
    return {
      kind: "value" as const,
      top,
      components,
      regression: regressLeaveOneOut(vectors, values, KNN_K),
    };
  }, [sample, model, labeled, pcaResult]);

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

  const n = sample.points.length;
  const sourceName = state.source?.name ?? "unknown source";
  const runFooter = `n = ${n} · ${sourceName} · ${new Date(sample.retrievedAt).toLocaleString()}`;
  const nLabeled = labeled?.length ?? 0;
  const smallCaveat =
    nLabeled > 0 && nLabeled < SMALL_N
      ? ` Only ${nLabeled} labeled points — treat this as a rough first look, not a conclusion.`
      : "";

  const attachTarget = (
    <button type="button" className="btn btn--primary" onClick={() => setOpenStep("target")}>
      Attach a real target
    </button>
  );

  return (
    <div className="view-panel view-panel--scroll">
      <div className="view-panel__header">
        <span className="view-panel__title">Analysis</span>
        <span className="popover-copy popover-copy--muted">{n.toLocaleString()} points · runs in your browser</span>
      </div>

      {pcaResult ? (
        <ResultCard
          title="How much structure is there?"
          stat={`PC1 ${(pcaResult.varianceExplained[0] * 100).toFixed(0)}%`}
          interpretation={`Principal component analysis finds the main directions of variation. The first ${pcaResult.varianceExplained.length} components explain ${(pcaResult.varianceExplained.reduce((a, b) => a + b, 0) * 100).toFixed(0)}% of the variation — the higher, the more the landscape here is dominated by a few distinct patterns.`}
          footer={`PCA, covariance, ${pcaResult.varianceExplained.length} components · ${runFooter}`}
        >
          <div className="bar-chart" role="img" aria-label="Variance explained per component">
            {pcaResult.varianceExplained.map((v, i) => (
              <div key={i} className="bar-chart__item">
                <span className="bar-chart__value">{(v * 100).toFixed(0)}%</span>
                <div className="bar-chart__track">
                  <div className="bar-chart__fill" style={{ height: `${Math.min(100, v * 100)}%` }} />
                </div>
                <span className="bar-chart__label">PC{i + 1}</span>
              </div>
            ))}
          </div>
        </ResultCard>
      ) : (
        <ResultCard
          title="How much structure is there?"
          stat="—"
          interpretation="PCA needs at least 2 points with variation; try a larger or more diverse sample."
          footer={runFooter}
        />
      )}

      <ResultCard
        title="Natural groupings (k-means)"
        stat={state.clusters ? `${state.clusters.k} clusters` : "not run"}
        interpretation="Groups points whose embeddings are alike. Colors carry over to the map and every view — the same color always means the same cluster. Look at the map: do the clusters follow real features like forest edges, fields or towns?"
        footer={`k-means, k=${k}, euclidean, n=${n}`}
      >
        <label className="field">
          <span className="field__label">
            Number of clusters <span className="field__value">{k}</span>
          </span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={k}
            onChange={(e) => {
              const next = Number(e.target.value);
              setK(next);
              // Once clustering is on, re-run live as the slider moves.
              if (state.clusters) runClustering(next);
            }}
          />
        </label>
        {state.clusters && (
          <div className="cluster-sizes" aria-label="Cluster sizes">
            {Array.from({ length: state.clusters.k }, (_, c) => (
              <span key={c} className="cluster-chip">
                <span className="cluster-chip__dot" style={{ background: categorical(c) }} />
                {state.clusters!.assignments.filter((a) => a === c).length}
              </span>
            ))}
          </div>
        )}
        <div className="result-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => runClustering(k)}
            disabled={n < k}
          >
            {state.clusters ? "Re-run" : "Find clusters"}
          </button>
          {state.clusters && state.colorBasis !== "cluster" && (
            <button type="button" className="btn" onClick={() => setColorBasis("cluster")}>
              Color by clusters
            </button>
          )}
          {state.clusters && (
            <button type="button" className="btn btn--ghost" onClick={clearClusters}>
              Clear
            </button>
          )}
        </div>
      </ResultCard>

      {!model && (
        <ResultCard
          title="Does it predict my target?"
          stat="needs a target"
          interpretation="Attach real ground truth — a CSV/GeoJSON of observations, or labels you click on the map — to measure how well the embedding predicts it."
          footer="correlation · k-NN classification / regression · leave-one-out"
        >
          <div className="result-actions">{attachTarget}</div>
        </ResultCard>
      )}

      {model && !supervised && (
        <ResultCard
          title={`Does it predict “${state.target?.name}”?`}
          stat={`${nLabeled} labeled`}
          interpretation={
            model.kind === "label"
              ? `Needs at least 4 labeled points across 2 or more classes (currently ${nLabeled} point${nLabeled === 1 ? "" : "s"}, ${model.classes.length} class${model.classes.length === 1 ? "" : "es"}). Label a few more points in the inspector.`
              : `Needs at least 4 target values that line up with sampled points (currently ${nLabeled}).` +
                (model.match.matchedRows > nLabeled
                  ? ` Your ${model.match.matchedRows} observations snapped to only ${nLabeled} sampled point${nLabeled === 1 ? "" : "s"} — draw a smaller area around them or retrieve more points so each gets its own.`
                  : " Try a larger sample, or an area that covers your observations.")
          }
          footer={`${model.match.unmatchedRows} of ${state.target?.rows.length ?? 0} target rows fall outside the sampled points`}
        />
      )}

      {supervised?.kind === "label" && (
        <ResultCard
          title={`Can it tell “${state.target?.name}” classes apart?`}
          stat={`${(supervised.report.accuracy * 100).toFixed(0)}% accuracy`}
          interpretation={`Each labeled point was hidden in turn and predicted from its ${supervised.report.k} most similar labeled neighbours. Guessing the most common class would score ${(supervised.report.baseline * 100).toFixed(0)}%, so the embedding ${supervised.report.accuracy > supervised.report.baseline + 0.1 ? "adds real signal" : "adds little beyond guessing"}.${smallCaveat}`}
          footer={`k-NN, k=${supervised.report.k}, cosine, leave-one-out · macro-F1 ${supervised.report.macroF1.toFixed(2)} · n=${supervised.report.n}`}
        >
          <ConfusionMatrix classes={supervised.report.classes} matrix={supervised.report.confusion} />
          <div className="result-actions">
            <button type="button" className="btn" onClick={() => setColorBasis("target")}>
              Show predictions on map
            </button>
          </div>
        </ResultCard>
      )}

      {supervised?.kind === "value" && (
        <>
          <ResultCard
            title={`Does it track “${state.target?.name}”?`}
            stat={`R² ${supervised.regression.r2.toFixed(2)}`}
            interpretation={`Each point's value was predicted from its ${supervised.regression.k} most similar neighbours (leave-one-out). R² = 1 is perfect, 0 is no better than always guessing the average${supervised.regression.r2 < 0.1 ? " — so here the embedding shows no usable signal for this target" : supervised.regression.r2 < 0.5 ? " — a partial signal" : " — a strong signal"}.${smallCaveat}`}
            footer={`k-NN regression, k=${supervised.regression.k}, cosine · RMSE ${supervised.regression.rmse.toPrecision(3)} · n=${supervised.regression.n}`}
          >
            <div className="result-actions">
              <button type="button" className="btn" onClick={() => setColorBasis("target")}>
                Show predictions on map
              </button>
            </div>
          </ResultCard>
          <ResultCard
            title="Which dimensions correlate?"
            stat={`|r| ${Math.abs(supervised.top[0]?.r ?? 0).toFixed(2)} · dim ${supervised.top[0]?.d ?? "—"}`}
            interpretation={`The strongest single dimension has a ${strength(supervised.top[0]?.r ?? 0)} correlation with the target. Bars show the ${supervised.top.length} strongest; teal is positive, orange negative.${smallCaveat}`}
            footer={`Pearson r per dimension · n=${nLabeled}`}
          >
            <CorrelationBars items={supervised.top.map((t) => ({ label: `d${t.d}`, r: t.r }))} />
            {supervised.components.length > 0 && (
              <>
                <div className="block-title">Principal components</div>
                <CorrelationBars items={supervised.components.map((r, i) => ({ label: `PC${i + 1}`, r }))} />
              </>
            )}
          </ResultCard>
        </>
      )}
    </div>
  );
}

function CorrelationBars({ items }: { items: Array<{ label: string; r: number }> }) {
  return (
    <div className="corr-bars" role="img" aria-label="Correlation by dimension">
      {items.map(({ label, r }) => (
        <div key={label} className="corr-bars__row">
          <span className="corr-bars__label">{label}</span>
          <span className="corr-bars__track">
            <span
              className={`corr-bars__fill${r < 0 ? " is-negative" : ""}`}
              style={{ width: `${Math.min(100, Math.abs(r) * 100)}%` }}
            />
          </span>
          <span className="corr-bars__value">{r.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function ConfusionMatrix({ classes, matrix }: { classes: string[]; matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="confusion">
      <table>
        <thead>
          <tr>
            <th className="confusion__corner">actual ↓ / predicted →</th>
            {classes.map((c, i) => (
              <th key={c}>
                <span className="legend__swatch" style={{ background: categorical(i) }} /> {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, a) => (
            <tr key={classes[a]}>
              <th>{classes[a]}</th>
              {row.map((v, p) => (
                <td
                  key={p}
                  className={a === p ? "is-diagonal" : ""}
                  style={{ ["--heat" as string]: String(v / max) }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
