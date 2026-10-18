import { useState } from "react";
import { useWorkspace } from "../../app/workspace.tsx";
import { usePointColors } from "../../app/pointColors.ts";
import EmbeddingScatter from "../../visualization/EmbeddingScatter.tsx";
import { useThemeColors } from "../../app/theme.tsx";

/** Embedding space view: PCA/UMAP scatter, linked to the map. */
export default function EmbeddingView() {
  const { state, selectPoint, setHoveredPoint } = useWorkspace();
  const colors = useThemeColors();
  const pointColors = usePointColors();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="view-panel">
      <div className="view-panel__header">
        <span className="view-panel__title">Embedding space</span>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="About this projection"
          onClick={() => setInfoOpen((v) => !v)}
        >
          ⓘ
        </button>
      </div>

      {infoOpen && (
        <p className="popover-copy view-panel__info">
          PCA finds the directions of greatest variation in the embedding vectors and projects them
          into two dimensions for viewing. Points that sit close together here have similar
          embeddings, even if they are far apart on the map. Hover a point to see where it is; click
          it to inspect it.
        </p>
      )}

      {state.sample ? (
        <EmbeddingScatter
          points={state.sample.points}
          pointColors={pointColors}
          neutralColor={colors.neutral}
          accentColor={colors.accent}
          selectedPointId={state.selectedPointId}
          hoveredPointId={state.hoveredPointId}
          queryPointId={state.queryPointId}
          onSelectPoint={selectPoint}
          onHoverPoint={(id) => setHoveredPoint(id)}
        />
      ) : (
        <div className="view-panel__empty">
          <p>Retrieve a sample to see embedding space.</p>
          <p className="popover-copy popover-copy--muted">
            Points here are the same points you see on the map, projected by PCA.
          </p>
        </div>
      )}

      <div className="view-panel__axis">
        <span>Component 1 →</span>
        <span>Component 2 →</span>
      </div>
    </div>
  );
}