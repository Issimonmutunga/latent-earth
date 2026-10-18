import type { EarthEngineApi, GoogleIdentityServices } from "../../types/earthengine.ts";

export const EARTH_ENGINE_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/@google/earthengine@1.7.40/build/ee_api_js.js";

/** Google Identity Services — the supported browser OAuth library. */
export const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string, ready: () => boolean, name: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error(`${name} is only available in the browser.`));
  }
  if (ready()) return Promise.resolve();
  const existing = scripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (ready()) {
        resolve();
      } else {
        scripts.delete(src);
        reject(new Error(`${name} loaded but did not initialise.`));
      }
    };
    script.onerror = () => {
      scripts.delete(src);
      reject(new Error(`Failed to load ${name}. Check your connection or ad blocker.`));
    };
    document.head.appendChild(script);
  });
  scripts.set(src, promise);
  return promise;
}

export async function ensureEarthEngine(): Promise<EarthEngineApi> {
  await loadScript(EARTH_ENGINE_SCRIPT_URL, () => Boolean(window.ee), "the Earth Engine client");
  return window.ee!;
}

export async function ensureGoogleIdentity(): Promise<GoogleIdentityServices> {
  await loadScript(
    GOOGLE_IDENTITY_SCRIPT_URL,
    () => typeof window.google?.accounts?.oauth2?.initTokenClient === "function",
    "Google sign-in",
  );
  return window.google!;
}
