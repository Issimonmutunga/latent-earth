import { useEffect, useSyncExternalStore } from "react";
import {
  connectEarthEngine,
  disconnectEarthEngine,
  getEarthEngineError,
  getEarthEngineStatus,
  prepareEarthEngine,
  subscribeEarthEngine,
} from "../embeddings/gee/connection.ts";

export default function EarthEngineConnection() {
  const status = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const error = useSyncExternalStore(subscribeEarthEngine, getEarthEngineError);

  useEffect(() => {
    void prepareEarthEngine().catch(() => {});
  }, []);

  if (status === "not-configured") {
    return (
      <div className="connection-panel">
        <p className="connection-panel__title">Google Earth Engine</p>
        <p className="popover-copy">
          AlphaEarth runs through your own Earth Engine account. Set <code>VITE_GEE_PROJECT_ID</code>{" "}
          (an Earth Engine-registered Cloud project) and <code>VITE_GEE_CLIENT_ID</code> (a Web OAuth
          client in that project with <code>{window.location.origin}</code> as an authorized JavaScript
          origin), then rebuild the app.
        </p>
      </div>
    );
  }

  const connected = status === "connected";
  const connecting = status === "connecting";

  return (
    <div className="connection-panel">
      <p className="connection-panel__title">Google Earth Engine</p>
      {connected ? (
        <div className="connection-panel__row">
          <span className="status-dot status-dot--ok" aria-hidden /> Signed in — retrievals use your
          Earth Engine quota.
          <button type="button" className="btn btn--ghost btn--small" onClick={disconnectEarthEngine}>
            Sign out
          </button>
        </div>
      ) : (
        <>
          <p className="popover-copy popover-copy--muted">
            Sign in once with the Google account that has Earth Engine access. You can also just press
            Retrieve — it signs you in first.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={connecting}
            onClick={() => void connectEarthEngine().catch(() => {})}
          >
            {connecting ? "Waiting for Google…" : "Sign in with Google"}
          </button>
        </>
      )}
      {error && !connected && <p className="popover-copy popover-copy--error">{error}</p>}
    </div>
  );
}
