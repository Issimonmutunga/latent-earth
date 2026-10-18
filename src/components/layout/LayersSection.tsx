import { useWorkspace, type ColorBasis } from "../../app/workspace.tsx";
import { useTargetModel } from "../../app/targetModel.tsx";
import { BASEMAP_LABELS, type BasemapKey } from "../../map/basemap.ts";

export interface LayerVisibility {
  points: boolean;
  area: boolean;
}

const COLOR_OPTIONS: Array<{ basis: ColorBasis; label: string }> = [
  { basis: "neutral", label: "Plain" },
  { basis: "cluster", label: "Clusters" },
  { basis: "similarity", label: "Similarity" },
  { basis: "target", label: "Target" },
];

export const DEFAULT_K = 4;

function Eye({ on, label, onToggle, disabled }: { on: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`eye-btn${on ? " is-on" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={on}
      aria-label={`${on ? "Hide" : "Show"} ${label}`}
      title={`${on ? "Hide" : "Show"} ${label}`}
    >
      {on ? "◉" : "○"}
    </button>
  );
}

/** GIS-style layer list: basemap, data layers, and point symbology. */
export default function LayersSection({
  basemap,
  onBasemap,
  layers,
  onLayers,
}: {
  basemap: BasemapKey;
  onBasemap: (key: BasemapKey) => void;
  layers: LayerVisibility;
  onLayers: (layers: LayerVisibility) => void;
}) {
  const { state, setColorBasis, runClustering } = useWorkspace();
  const model = useTargetModel();
  const { sample, area, colorBasis, clusters, queryPointId } = state;

  const reason: Partial<Record<ColorBasis, string>> = {
    neutral: sample ? undefined : "Retrieve a sample first",
    cluster: sample ? undefined : "Retrieve a sample first",
    similarity: queryPointId ? undefined : "Inspect a point and choose “Find similar places” first",
    target: model?.predicted ? undefined : "Attach ground truth or label a few points first",
  };

  function choose(basis: ColorBasis) {
    if (basis === "cluster" && !clusters) runClustering(DEFAULT_K);
    else setColorBasis(basis);
  }

  return (
    <section className="layers">
      <div className="panel-heading">Layers</div>

      <div className="layer-row">
        <Eye on={layers.points} label="sample points" disabled={!sample} onToggle={() => onLayers({ ...layers, points: !layers.points })} />
        <div className="layer-row__main">
          <span className="layer-row__name">Sample points</span>
          <span className="layer-row__meta">
            {sample ? `${sample.points.length.toLocaleString()} points` : "Not loaded yet"}
          </span>
        </div>
      </div>

      {sample && (
        <div className="layer-style">
          <span className="layer-style__label">Color by</span>
          <div className="segmented segmented--full" role="radiogroup" aria-label="Color points by">
            {COLOR_OPTIONS.map(({ basis, label }) => (
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
            <div className="chip-row">
              <span className="layer-style__label">Clusters</span>
              {[3, 4, 5, 6].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip${clusters.k === k ? " is-active" : ""}`}
                  onClick={() => runClustering(k)}
                  title={`Re-run k-means with ${k} clusters`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="layer-row">
        <Eye on={layers.area} label="area outline" disabled={!area} onToggle={() => onLayers({ ...layers, area: !layers.area })} />
        <div className="layer-row__main">
          <span className="layer-row__name">Area of interest</span>
          <span className="layer-row__meta">{area ? "Dashed outline" : "Not set"}</span>
        </div>
      </div>

      <div className="layer-row layer-row--basemap">
        <span className="layer-row__icon" aria-hidden>
          ▦
        </span>
        <div className="layer-row__main">
          <span className="layer-row__name">Basemap</span>
          <div className="segmented segmented--full" role="radiogroup" aria-label="Basemap">
            {(Object.keys(BASEMAP_LABELS) as BasemapKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={basemap === key}
                className={`segmented__item${basemap === key ? " is-active" : ""}`}
                onClick={() => onBasemap(key)}
                title={`${BASEMAP_LABELS[key]} basemap (B to cycle)`}
              >
                {BASEMAP_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
