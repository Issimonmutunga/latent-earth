import { useWorkspace } from "../app/workspace.tsx";
import { useTargetModel } from "../app/targetModel.tsx";
import { categorical, viridis } from "../visualization/colors.ts";

const GRADIENT_STOPS = [0, 0.25, 0.5, 0.75, 1];

function Gradient({ low, high }: { low: string; high: string }) {
  return (
    <>
      <div className="legend__gradient">
        {GRADIENT_STOPS.map((t) => (
          <span key={t} style={{ background: viridis(t) }} />
        ))}
      </div>
      <div className="legend__scale">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </>
  );
}

/** Map-corner legend for the active point symbology (hidden for plain points). */
export default function MapLegend() {
  const { state } = useWorkspace();
  const model = useTargetModel();
  const { colorBasis, clusters, queryPointId, sample } = state;
  if (!sample) return null;

  let title: string | null = null;
  let body: React.ReactNode = null;

  if (colorBasis === "cluster" && clusters) {
    title = `Clusters · k-means k=${clusters.k}`;
    body = (
      <ul className="legend__list">
        {Array.from({ length: clusters.k }, (_, c) => (
          <li key={c} className="legend__item">
            <span className="legend__swatch" style={{ background: categorical(c) }} />
            Cluster {c + 1}
            <span className="legend__count">{clusters.assignments.filter((a) => a === c).length}</span>
          </li>
        ))}
      </ul>
    );
  } else if (colorBasis === "similarity" && queryPointId) {
    title = `Similarity to ${queryPointId}`;
    body = <Gradient low="different" high="similar" />;
  } else if (colorBasis === "target" && model?.predicted) {
    title = `Target · ${state.target?.name ?? ""} (predicted)`;
    body =
      model.kind === "label" ? (
        <ul className="legend__list">
          {model.classes.map((c, i) => (
            <li key={c} className="legend__item">
              <span className="legend__swatch" style={{ background: categorical(i) }} />
              {c}
            </li>
          ))}
        </ul>
      ) : model.range ? (
        <Gradient low={model.range.min.toPrecision(3)} high={model.range.max.toPrecision(3)} />
      ) : null;
  }

  if (!title) return null;
  return (
    <div className="map-legend" aria-label="Legend">
      <div className="map-legend__title">{title}</div>
      {body}
    </div>
  );
}
