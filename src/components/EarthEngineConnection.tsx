import { useEffect, useSyncExternalStore } from "react";
import { ensureEarthEngine, ensureGoogleApi } from "../embeddings/gee/loader.ts";
import {
  connectEarthEngine,
  disconnectEarthEngine,
  getEarthEngineError,
  getEarthEngineStatus,
  signInEarthEngine,
  subscribeEarthEngine,
} from "../embeddings/gee/connection.ts";

export default function EarthEngineConnection() {
  const status = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const error = useSyncExternalStore(subscribeEarthEngine, getEarthEngineError);

  useEffect(() => {
    void Promise.allSettled([ensureGoogleApi(), ensureEarthEngine()]);
  }, []);

  const unconfigured = status === "not-configured";
  const connected = status === "connected";
  const connecting = status === "connecting";
  const authPending = status === "auth-pending";

  function toggle() {
    if (connected) {
      disconnectEarthEngine();
    } else {
      void connectEarthEngine().catch(() => {});
    }
  }

  function signIn() {
    void signInEarthEngine().catch(() => {});
  }

  return (
    <div className="connection-panel">
      <p className="connection-panel__title">Google Earth Engine</p>
      {unconfigured && (
        <p className="popover-copy">
          AlphaEarth runs through your own Earth Engine account. Set{" "}
          <code>VITE_GEE_PROJECT_ID</code> (your Earth Engine-enabled Cloud Project ID) and{" "}
          <code>VITE_GEE_CLIENT_ID</code> (a Web OAuth client ID of that project, with{" "}
          <code>http://localhost:5199</code> as an authorized JavaScript origin) and reload the app.
        </p>
      )}
      {!unconfigured && !authPending && (
        <button type="button" className="btn btn--ghost" disabled={connecting} onClick={toggle}>
          {connected ? "Disconnect" : connecting ? "Connecting…" : "Connect"}
        </button>
      )}
      {authPending && (
        <>
          <p className="popover-copy">
            A popup was blocked by your browser. Click below to continue signing in from this button:
          </p>
          <button type="button" className="btn btn--primary" onClick={signIn}>
            Sign in with Google
          </button>
        </>
      )}
      {connected && (
        <p className="popover-copy popover-copy--muted">
          Connected. Retrieval runs against your Earth Engine quota.
        </p>
      )}
      {(!unconfigured && error && !authPending) && (
        <p className="popover-copy popover-copy--error">{error}</p>
      )}
    </div>
  );
}
