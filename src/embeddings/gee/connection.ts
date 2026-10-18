import type { EarthEngineApi, TokenClient, TokenResponse } from "../../types/earthengine.ts";
import { getGeeClientId, getGeeProjectId, isConfigured } from "./config.ts";
import { ensureEarthEngine, ensureGoogleIdentity } from "./loader.ts";

/**
 * Earth Engine sign-in through Google Identity Services (GIS).
 *
 * GIS opens its consent popup only from a user gesture, so the libraries are
 * loaded ahead of time (`prepareEarthEngine`) and `connectEarthEngine` asks
 * for the token synchronously inside the click that calls it.
 */

export type EarthEngineStatus =
  | "not-configured"
  | "idle"
  | "connecting"
  | "auth-pending"
  | "connected";

export const READ_ONLY_SCOPES = ["https://www.googleapis.com/auth/earthengine.readonly"];

export const NOT_CONFIGURED_MESSAGE =
  "Google Earth Engine is not configured. Set VITE_GEE_PROJECT_ID (your Earth Engine-enabled Cloud Project ID) and VITE_GEE_CLIENT_ID (the OAuth client ID of that project).";

interface ConnectionState {
  status: EarthEngineStatus;
  error: string | null;
  api: EarthEngineApi | null;
  tokenClient: TokenClient | null;
  /** Receives the next token response (sign-in or refresh). */
  onToken: ((response: TokenResponse) => void) | null;
  inflight: Promise<EarthEngineApi | null> | null;
}

const state: ConnectionState = {
  status: "idle",
  error: null,
  api: null,
  tokenClient: null,
  onToken: null,
  inflight: null,
};
const listeners = new Set<() => void>();
let preparing: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function update(partial: Partial<Pick<ConnectionState, "status" | "error">>): void {
  Object.assign(state, partial);
  emit();
}

export function subscribeEarthEngine(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEarthEngineStatus(): EarthEngineStatus {
  return isConfigured() ? state.status : "not-configured";
}

export function getEarthEngineError(): string | null {
  return getEarthEngineStatus() === "not-configured" ? null : state.error;
}

export function getEarthEngineApi(): EarthEngineApi | null {
  return getEarthEngineStatus() === "connected" ? state.api : null;
}

function messageFrom(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Google Earth Engine connection failed.";
}

/** Turn raw Earth Engine / OAuth errors into something a researcher can act on. */
export function describeEarthEngineError(raw: unknown): string {
  const message = messageFrom(raw);
  const project = getGeeProjectId() ?? "your Cloud project";
  if (/not (been )?registered|not signed up|register/i.test(message)) {
    return `Earth Engine isn't enabled for this account or project (${project}). Register the project for Earth Engine at code.earthengine.google.com/register, then try again.`;
  }
  if (/permission|PERMISSION_DENIED|403|caller does not have/i.test(message)) {
    return `Your Google account can't use Earth Engine in project ${project}. Ask the project owner to give you the "Earth Engine Resource Viewer" and "Service Usage Consumer" roles. (${message})`;
  }
  if (/quota|rate limit|too many/i.test(message)) {
    return `Earth Engine is rate-limiting requests. Wait a moment, or retrieve fewer points. (${message})`;
  }
  if (/memory|timed out|computation/i.test(message)) {
    return `Earth Engine couldn't finish this request. Try a smaller area or fewer points. (${message})`;
  }
  return message;
}

function describeTokenError(response: TokenResponse): string {
  if (response.error === "access_denied") {
    return "Google sign-in was declined. Allow read-only Earth Engine access to use AlphaEarth.";
  }
  return `Google sign-in failed: ${response.error_description ?? response.error ?? "unknown error"}.`;
}

function requireConfig(): { projectId: string; clientId: string } {
  const projectId = getGeeProjectId();
  const clientId = getGeeClientId();
  if (!projectId || !clientId) throw new Error(NOT_CONFIGURED_MESSAGE);
  return { projectId, clientId };
}

/** Load Google sign-in and the Earth Engine client ahead of the click that needs them. */
export function prepareEarthEngine(): Promise<void> {
  if (!isConfigured()) return Promise.resolve();
  if (state.tokenClient && window.ee) return Promise.resolve();
  if (preparing) return preparing;
  const { clientId } = requireConfig();
  preparing = Promise.all([ensureGoogleIdentity(), ensureEarthEngine()])
    .then(([google, ee]) => {
      state.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: READ_ONLY_SCOPES.join(" "),
        callback: (response) => {
          const handler = state.onToken;
          state.onToken = null;
          handler?.(response);
        },
        error_callback: (error) => {
          const handler = state.onToken;
          state.onToken = null;
          handler?.({
            error: error.type,
            error_description:
              error.type === "popup_failed_to_open"
                ? "your browser blocked the sign-in popup"
                : error.type === "popup_closed"
                  ? "the sign-in window was closed"
                  : error.message,
          });
        },
      });
      ee.data.setAuthTokenRefresher((_args, done) => {
        // Tokens last about an hour; ask GIS for a fresh one without a prompt.
        state.onToken = (response) =>
          done({
            access_token: response.access_token,
            token_type: response.token_type ?? "Bearer",
            expires_in: Number(response.expires_in ?? 3600),
            error: response.error,
          });
        state.tokenClient!.requestAccessToken({ prompt: "" });
      });
    })
    .catch((err) => {
      preparing = null;
      update({ status: "idle", error: messageFrom(err) });
      throw err;
    });
  return preparing;
}

function initialize(api: EarthEngineApi, projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    api.initialize(null, null, () => resolve(), (err) => reject(err), null, projectId);
  });
}

/**
 * Sign in and initialise Earth Engine. Call it directly from a click handler:
 * when the libraries are already loaded the Google popup opens inside that
 * gesture. Otherwise the status becomes "auth-pending" and the UI shows a
 * "Sign in with Google" button that completes the flow on the next click.
 */
export function connectEarthEngine(): Promise<EarthEngineApi | null> {
  let config: { projectId: string; clientId: string };
  try {
    config = requireConfig();
  } catch (err) {
    return Promise.reject(err);
  }
  if (state.status === "connected" && state.api) return Promise.resolve(state.api);
  if (state.inflight) return state.inflight;

  const tokenClient = state.tokenClient;
  const ee = window.ee;
  if (!tokenClient || !ee) {
    update({ status: "connecting", error: null });
    return prepareEarthEngine()
      .then(() => {
        update({
          status: "auth-pending",
          error: "Google sign-in is ready — click “Sign in with Google” to continue.",
        });
        return null;
      })
      .catch((err) => {
        update({ status: "idle", error: messageFrom(err) });
        throw err;
      });
  }

  update({ status: "connecting", error: null });
  const tokenPromise = new Promise<TokenResponse>((resolve) => {
    state.onToken = resolve;
  });
  // Must run synchronously inside the caller's click so the popup is allowed.
  tokenClient.requestAccessToken();

  state.inflight = tokenPromise
    .then(async (response) => {
      if (response.error || !response.access_token) {
        const blocked = response.error === "popup_failed_to_open";
        update({
          status: blocked ? "auth-pending" : "idle",
          error: blocked
            ? "Your browser blocked the Google sign-in popup. Allow popups for this site, or click “Sign in with Google”."
            : response.error === "popup_closed"
              ? `The sign-in window was closed. If Google showed an error such as “origin_mismatch”, add ${window.location.origin} to the OAuth client's Authorized JavaScript origins.`
              : describeTokenError(response),
        });
        return null;
      }
      ee.data.setAuthToken(
        config.clientId,
        response.token_type ?? "Bearer",
        response.access_token,
        Number(response.expires_in ?? 3600),
        [],
        undefined,
        false,
      );
      try {
        await initialize(ee, config.projectId);
      } catch (err) {
        update({ status: "idle", error: describeEarthEngineError(err) });
        return null;
      }
      state.api = ee;
      update({ status: "connected", error: null });
      return ee;
    })
    .finally(() => {
      state.inflight = null;
    });
  return state.inflight;
}

/** Same as connecting; kept as the explicit "Sign in with Google" action. */
export function signInEarthEngine(): Promise<EarthEngineApi | null> {
  return connectEarthEngine();
}

export function disconnectEarthEngine(): void {
  try {
    state.api?.data.clearAuthToken?.();
  } catch {
    void 0;
  }
  state.api = null;
  update({ status: "idle", error: null });
}
