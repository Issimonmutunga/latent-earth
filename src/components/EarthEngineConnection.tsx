import { useSyncExternalStore } from "react";
import {
  connectEarthEngine,
  disconnectEarthEngine,
  getEarthEngineError,
  getEarthEngineStatus,
  subscribeEarthEngine,
} from "../embeddings/gee/connection.ts";

export default function EarthEngineConnection() {
  const status = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const error = useSyncExternalStore(subscribeEarthEngine, getEarthEngineError);

  const unconfigured = status === "not-configured";
  const connected = status === "connected";
  const connecting = status === "connecting";

  function toggle() {
    if (connected) {
      disconnectEarthEngine();
    } else {
      void connectEarthEngine().catch(() => {});
    }
  }

  return (
    <div className="connection-panel">
      <p className="connection-panel__title">Google Earth Engine</p>
      {unconfigured && (
        <p className="popover-copy">
          AlphaEarth runs through your own Earth Engine account. Add <code>VITE_GEE_PROJECT_ID</code>{" "}
          (your Earth Engine-enabled Cloud Project ID) and reload the app.
        </p>
      )}
      {!unconfigured && (
        <button type="button" className="btn btn--ghost" disabled={connecting} onClick={toggle}>
          {connected ? "Disconnect" : connecting ? "Connecting…" : "Connect"}
        </button>
      )}
      {connected && (
        <p className="popover-copy popover-copy--muted">
          Connected. Retrieval runs against your Earth Engine quota.
        </p>
      )}
      {!unconfigured && !connected && error && (
        <p className="popover-copy popover-copy--error">{error}</p>
      )}
    </div>
  );
}