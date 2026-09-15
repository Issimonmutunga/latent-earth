import type { EarthEngineApi } from "../../types/earthengine.ts";
import { getGeeClientId, getGeeProjectId, isConfigured } from "./config.ts";
import { ensureEarthEngine, ensureGoogleApi } from "./loader.ts";

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
  preparedApi: EarthEngineApi | null;
}

const state: ConnectionState = { status: "idle", error: null, api: null, preparedApi: null };
const listeners = new Set<() => void>();

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
  return err instanceof Error ? err.message : "Google Earth Engine connection failed.";
}

function initialize(api: EarthEngineApi, projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    api.initialize(null, null, () => resolve(), (err) => reject(err), null, projectId);
  });
}

async function finalizeConnection(api: EarthEngineApi, projectId: string): Promise<void> {
  try {
    await initialize(api, projectId);
  } catch (err) {
    update({ status: "idle", error: messageFrom(err) });
    throw new Error(messageFrom(err));
  }
  state.api = api;
  update({ status: "connected", error: null });
}

async function prepare(): Promise<EarthEngineApi> {
  await ensureGoogleApi();
  return ensureEarthEngine();
}

function requireConfig(): { projectId: string; clientId: string } {
  const projectId = getGeeProjectId();
  const clientId = getGeeClientId();
  if (!projectId || !clientId) throw new Error(NOT_CONFIGURED_MESSAGE);
  return { projectId, clientId };
}

export async function connectEarthEngine(): Promise<EarthEngineApi | null> {
  const { projectId, clientId } = requireConfig();
  if (state.status === "connected" && state.api) return state.api;
  if (state.status === "auth-pending") return null;
  update({ status: "connecting", error: null });
  try {
    state.preparedApi = await prepare();
  } catch (err) {
    update({ status: "idle", error: messageFrom(err) });
    throw new Error(messageFrom(err));
  }
  const api = state.preparedApi;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      update({
        status: "auth-pending",
        error:
          "The silent sign-in timed out. Click Sign in with Google below to continue.",
      });
      resolve();
    }, 30000);
    api.data.authenticateViaOauth(
      clientId,
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      (err) => {
        window.clearTimeout(timer);
        update({ status: "idle", error: messageFrom(err) });
        reject(new Error(messageFrom(err)));
      },
      READ_ONLY_SCOPES,
      () => {
        window.clearTimeout(timer);
        update({ status: "auth-pending", error: null });
        resolve();
      },
      true,
    );
  });
  if (state.status === "connecting") {
    await finalizeConnection(api, projectId);
  }
  return state.status === "connected" ? state.api : null;
}

export async function signInEarthEngine(): Promise<EarthEngineApi | null> {
  const { projectId } = requireConfig();
  if (state.status === "connected" && state.api) return state.api;
  const api = state.preparedApi ?? (await prepare());
  state.preparedApi = api;
  update({ status: "connecting", error: null });
  await new Promise<void>((resolve, reject) => {
    api.data.authenticateViaPopup(
      () => resolve(),
      (err) => {
        update({ status: "idle", error: messageFrom(err) });
        reject(new Error(messageFrom(err)));
      },
    );
  });
  await finalizeConnection(api, projectId);
  return state.status === "connected" ? state.api : null;
}

export function disconnectEarthEngine(): void {
  if (state.api?.data.reset) {
    try {
      state.api.data.reset();
    } catch {
      void 0;
    }
  }
  state.api = null;
  update({ status: "idle", error: null });
}
