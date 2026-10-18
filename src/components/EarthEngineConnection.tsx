import { useEffect, useState, useSyncExternalStore } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import {
  connectEarthEngine,
  disconnectEarthEngine,
  getEarthEngineError,
  getEarthEngineProject,
  getEarthEngineStatus,
  prepareEarthEngine,
  setEarthEngineProject,
  subscribeEarthEngine,
} from "../embeddings/gee/connection.ts";

/** One-time AlphaEarth setup: the researcher's own project, then Google sign-in. */
export default function EarthEngineConnection() {
  const { openGuide } = useWorkspace();
  const status = useSyncExternalStore(subscribeEarthEngine, getEarthEngineStatus);
  const error = useSyncExternalStore(subscribeEarthEngine, getEarthEngineError);
  const project = useSyncExternalStore(subscribeEarthEngine, getEarthEngineProject);
  const [draft, setDraft] = useState(project ?? "");
  const [editing, setEditing] = useState(!project);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    void prepareEarthEngine().catch(() => {});
  }, []);

  if (status === "not-configured") {
    return (
      <div className="connection-panel">
        <p className="connection-panel__title">Google Earth Engine</p>
        <p className="popover-copy">
          Google sign-in isn't set up for this deployment yet. Whoever runs this site needs to set{" "}
          <code>VITE_GEE_CLIENT_ID</code> — see the README.
        </p>
      </div>
    );
  }

  const connected = status === "connected";
  const connecting = status === "connecting";

  function saveProject(e: React.FormEvent) {
    e.preventDefault();
    const problem = setEarthEngineProject(draft);
    setProjectError(problem);
    if (!problem) setEditing(false);
  }

  return (
    <div className="connection-panel">
      <p className="connection-panel__title">Set up AlphaEarth · one time</p>
      <p className="popover-copy popover-copy--muted">
        AlphaEarth runs on your own free Earth Engine project, so your usage never depends on
        anyone else's quota.{" "}
        <button type="button" className="link-btn link-btn--inline" onClick={() => openGuide("setup")}>
          How do I get one?
        </button>
      </p>

      <ol className="setup-steps">
        <li className={project ? "is-done" : "is-current"}>
          <span className="setup-steps__label">Your Earth Engine project ID</span>
          {editing || !project ? (
            <form className="inline-form" onSubmit={saveProject}>
              <input
                className="input input--mono"
                placeholder="e.g. ee-yourname"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Earth Engine project ID"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
                Save
              </button>
            </form>
          ) : (
            <div className="connection-panel__row">
              <code>{project}</code>
              <button type="button" className="link-btn" onClick={() => setEditing(true)}>
                change
              </button>
            </div>
          )}
          {projectError && <p className="popover-copy popover-copy--error">{projectError}</p>}
        </li>

        <li className={connected ? "is-done" : project ? "is-current" : ""}>
          <span className="setup-steps__label">Sign in with the Google account that owns it</span>
          {connected ? (
            <div className="connection-panel__row">
              <span className="status-dot status-dot--ok" aria-hidden /> Signed in
              <button type="button" className="link-btn" onClick={disconnectEarthEngine}>
                sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={connecting || !project}
              onClick={() => void connectEarthEngine().catch(() => {})}
            >
              {connecting ? "Waiting for Google…" : "Sign in with Google"}
            </button>
          )}
        </li>
      </ol>

      {!connected && project && (
        <p className="popover-copy popover-copy--muted">
          Or skip this — pressing Retrieve signs you in first. Access is read-only, and the sign-in
          lasts only for this browser tab.
        </p>
      )}
      {error && !connected && <p className="popover-copy popover-copy--error">{error}</p>}
    </div>
  );
}
