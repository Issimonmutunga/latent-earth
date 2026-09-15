import type { EarthEngineApi } from "../../types/earthengine.ts";

export const EARTH_ENGINE_SCRIPT_URL =
  "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.365/earthengine-api.min.js";

export const GOOGLE_API_SCRIPT_URL = "https://apis.google.com/js/client.js";

export interface GoogleApiClient {
  auth: {
    authorize: (
      config: { client_id: string; immediate: boolean; scope: string },
      callback: (result: unknown) => void,
    ) => void;
  };
}

let pending: Promise<EarthEngineApi> | null = null;

export function ensureEarthEngine(): Promise<EarthEngineApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Earth Engine client is only available in the browser."));
  }
  if (window.ee) return Promise.resolve(window.ee);
  if (pending) return pending;
  pending = new Promise<EarthEngineApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = EARTH_ENGINE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.ee) {
        resolve(window.ee);
      } else {
        pending = null;
        reject(new Error("Earth Engine client loaded without an `ee` global."));
      }
    };
    script.onerror = () => {
      pending = null;
      reject(new Error("Failed to load the Earth Engine API client."));
    };
    document.head.appendChild(script);
  });
  return pending;
}

let gapiPending: Promise<void> | null = null;

function isGapiReady(): boolean {
  const gapi = (window as unknown as { gapi?: GoogleApiClient }).gapi;
  return typeof gapi?.auth?.authorize === "function";
}

function loadGoogleApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google API client is only available in the browser."));
      return;
    }
    if (isGapiReady()) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_API_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (isGapiReady()) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 20000) {
          window.clearInterval(timer);
          gapiPending = null;
          reject(new Error("Timed out waiting for the Google API client library."));
        }
      }, 100);
    };
    script.onerror = () => {
      gapiPending = null;
      reject(new Error("Failed to load the Google API client library."));
    };
    document.head.appendChild(script);
  });
}

export function ensureGoogleApi(): Promise<void> {
  if (gapiPending) return gapiPending;
  gapiPending = loadGoogleApi();
  return gapiPending;
}