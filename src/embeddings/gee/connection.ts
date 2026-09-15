import type { EarthEngineApi } from "../../types/earthengine.ts";
import { getGeeProjectId, isConfigured } from "./config.ts";
import { ensureEarthEngine } from "./loader.ts";

export type EarthEngineStatus = "not-configured" | "idle" | "connecting" | "connected";

interface ConnectionState {
  status: EarthEngineStatus;
  error: string | null;
  api: EarthEngineApi | null;
}

const state: ConnectionState = { status: "idle", error: null, api: null };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
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

function authenticate(api: EarthEngineApi): Promise<void> {
  return new Promise((resolve, reject) => {
    api.data.authenticateViaPopup(
      () => resolve(),
      (err) => reject(err),
    );
  });
}

function initialize(api: EarthEngineApi, projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    api.initialize(null, null, () => resolve(), (err) => reject(err), null, projectId);
  });
}

export async function connectEarthEngine(): Promise<EarthEngineApi> {
  const projectId = getGeeProjectId();
  if (!projectId) {
    throw new Error(
      "Google Earth Engine is not configured. Set VITE_GEE_PROJECT_ID to your Earth Engine-enabled Cloud Project ID.",
    );
  }
  if (state.status === "connected" && state.api) return state.api;
  state.status = "connecting";
  state.error = null;
  emit();
  try {
    const api = await ensureEarthEngine();
    await authenticate(api);
    await initialize(api, projectId);
    state.api = api;
    state.status = "connected";
    state.error = null;
    emit();
    return api;
  } catch (err) {
    const message = messageFrom(err);
    state.status = "idle";
    state.error = message;
    emit();
    throw new Error(message);
  }
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
  state.status = "idle";
  state.error = null;
  emit();
}