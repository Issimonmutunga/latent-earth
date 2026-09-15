import { useMemo } from "react";
import { useWorkspace } from "../../app/workspace.tsx";
import { usePointColors } from "../../app/pointColors.ts";
import EmbeddingScatter from "../../visualization/EmbeddingScatter.tsx";
import { NEUTRAL_POINT, viridis } from "../../visualization/colors.ts";
import { rankBySimilarity } from "../../analysis/similarity.ts";

const BINS = 12;

/** Similarity view: one query point, every other point colored by distance to it. */
export default function SimilarityView() {
  const { state, selectPoint, setQueryPoint, setHoveredPoint } = useWorkspace();
  const pointColors = usePointColors() ?? (state.queryPointId ? new Map<string, string>() : null);

  const query = useMemo(
    () => state.sample?.points.find((p) => p.id === state.queryPointId) ?? null,
    [state.sample, state.queryPointId],
  );

  const ranked = useMemo(() => {
    if (!state.sample || !query) return null;
    return rankBySimilarity(state.sample.points, query);
  }, [state.sample, query]);

  const histogram = useMemo(() => {
    if (!ranked) return null;
    const counts = new Array(BINS).fill(0);
    let min = 1;
    let max = -1;
    for (const { similarity } of ranked) {
      min = Math.min(min, similarity);
      max = Math.max(max, similarity);
    }
    const span = Math.max(1e-6, max - min);
    for (const { similarity } of ranked) {
      const bin = Math.min(BINS - 1, Math.floor(((similarity - min) / span) * BINS));
      counts[bin] += 1;
    }
    return { counts, min, max };
  }, [ranked]);

  if (!state.sample || !query || !ranked || !histogram) {
    return (
      <div className="view-panel view-panel__empty">
        <p>Click any point on the map or in embedding space to set it as the similarity query.</p>
        <p className="popover-copy popover-copy--muted">
          “What places look similar to this location according to the embedding?”
        </p>
      </div>
    );
  }

  const mostSimilar = ranked.slice(0, 5);
  const mostDissimilar = ranked.slice(-5).reverse();
  const maxBin = Math.max(1, ...histogram.counts);
  const legend = [0, 0.25, 0.5, 0.75, 1].map((t) => viridis(t));

  return (
    <div className="view-panel">
      <div className="view-panel__header">
        <span className="view-panel__title">Similarity to {query.id}</span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setQueryPoint(null)}
        >
          Clear query
        </button>
      </div>

      <div className="view-row">
        <div className="view-col">
          <EmbeddingScatter
            points={state.sample.points}
            pointColors={pointColors}
            neutralColor={NEUTRAL_POINT}
            selectedPointId={state.selectedPointId}
            hoveredPointId={state.hoveredPointId}
            queryPointId={state.queryPointId}
            onSelectPoint={(id) => {
              selectPoint(id);
              if (id) setQueryPoint(id);
            }}
            onHoverPoint={(id) => setHoveredPoint(id)}
          />
        </div>
        <div className="view-col view-col--narrow">
          <div className="block-title">Score distribution</div>
          <div
            className="histogram"
            role="img"
            aria-label={`Cosine similarity histogram from ${histogram.min.toFixed(2)} to ${histogram.max.toFixed(2)}`}
          >
            {histogram.counts.map((c, i) => (
              <div
                key={i}
                className="histogram__bar"
                style={{ height: `${(c / maxBin) * 100}%` }}
                title={`${((histogram.min + ((histogram.max - histogram.min) * (i + 0.5)) / BINS)).toFixed(2)}: ${c} points`}
              />
            ))}
          </div>
          <div className="legend-line">
            {legend.map((c) => (
              <span key={c} className="legend-line__swatch" style={{ background: c }} />
            ))}
          </div>
          <div className="legend-line__labels">
            <span>−1</span>
            <span>0</span>
            <span>+1</span>
          </div>

          <div className="block-title">Most similar</div>
          <ul className="rank-list">
            {mostSimilar.map(({ point, similarity }) => (
              <li key={point.id}>
                <button
                  type="button"
                  className="rank-list__item"
                  onClick={() => selectPoint(point.id)}
                >
                  <span className="rank-list__id">{point.id}</span>
                  <span className="rank-list__val">{similarity.toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="block-title">Most dissimilar</div>
          <ul className="rank-list">
            {mostDissimilar.map(({ point, similarity }) => (
              <li key={point.id}>
                <button
                  type="button"
                  className="rank-list__item"
                  onClick={() => selectPoint(point.id)}
                >
                  <span className="rank-list__id">{point.id}</span>
                  <span className="rank-list__val">{similarity.toFixed(3)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}