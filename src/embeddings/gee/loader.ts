import type { EarthEngineApi } from "../../types/earthengine.ts";

export const EARTH_ENGINE_SCRIPT_URL =
  "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.365/earthengine-api.min.js";

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