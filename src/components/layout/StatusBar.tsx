import { useSyncExternalStore } from "react";
import { useWorkspace } from "../../app/workspace.tsx";
import { getMapStatus, subscribeMapStatus } from "../../map/mapHandle.ts";
import {
  getEarthEngineProject,
  getEarthEngineStatus,
  subscribeEarthEngine,
} from "../../embeddings/gee/connection.ts";

function formatCoord(value: number, pos: string, neg: string): string {
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? pos : neg}`;
}

/** Bottom strip: what's loaded, the connection, and where the cursor is. */
export default function StatusBar() {
  const { state } = useWorkspace();
  const map = useSyncExternalStore(subscribeMapStatus, getMapStatus);
  const eeStatus = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const eeProject = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);
  const { source, sample, status, drawing, sampleIsStale } = state;

  let activity: string;
  if (drawing) activity = "Drawing — drag on the map, Esc to cancel";
  else if (status.kind === "retrieving") activity = `Retrieving ${status.requested.toLocaleString()} points…`;
  else if (status.kind === "error") activity = "Last retrieval failed — see step 3";
  else if (sample)
    activity = `${sample.points.length.toLocaleString()} points · ${source?.name ?? sample.sourceId}${sample.query.date ? ` ${sample.query.date}` : ""}${sampleIsStale ? " · out of date" : ""}`;
  else activity = "Ready";

  const ee =
    source?.providerConnection === "earth-engine"
      ? eeStatus === "connected"
        ? { cls: "ok", text: `Earth Engine · ${eeProject}` }
        : eeStatus === "connecting"
          ? { cls: "busy", text: "Earth Engine · signing in…" }
          : eeStatus === "not-configured"
            ? { cls: "off", text: "Earth Engine · not configured" }
            : { cls: "off", text: `Earth Engine · ${eeProject ? "not signed in" : "no project"}` }
      : null;

  return (
    <footer className="status-bar" aria-label="Status">
      <span className={`status-bar__item${status.kind === "retrieving" ? " is-busy" : ""}`}>{activity}</span>
      {ee && (
        <span className="status-bar__item">
          <span className={`status-dot status-dot--${ee.cls}`} aria-hidden /> {ee.text}
        </span>
      )}
      <span className="status-bar__spacer" />
      <span className="status-bar__item status-bar__coords" aria-live="off">
        {map.cursor
          ? `${formatCoord(map.cursor.lat, "N", "S")}  ${formatCoord(map.cursor.lng, "E", "W")}`
          : "—"}
      </span>
      <span className="status-bar__item status-bar__zoom">z {map.zoom.toFixed(1)}</span>
    </footer>
  );
}
