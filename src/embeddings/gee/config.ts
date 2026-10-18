export interface AlphaEarthDataset {
  collectionId: string;
  bands: string[];
  firstYear: number;
  lastYear: number;
  spatialResolution: number;
  attribution: string;
}

export const ALPHAEARTH: AlphaEarthDataset = {
  collectionId: "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL",
  bands: Array.from({ length: 64 }, (_, i) => `A${String(i).padStart(2, "0")}`),
  firstYear: 2017,
  lastYear: 2025,
  spatialResolution: 10,
  attribution:
    "The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind.",
};

const PROJECT_STORAGE_KEY = "latent-earth:ee-project";

/**
 * Optional build-time project, for private deployments where everyone shares
 * one project. Public deployments leave it unset so each researcher uses
 * their own project (and quota).
 */
export function getDefaultProjectId(): string | null {
  const value = import.meta.env.VITE_GEE_PROJECT_ID;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Accepts "my-project" or a pasted "projects/my-project"; returns null if invalid. */
export function normalizeProjectId(input: string): string | null {
  const id = input.trim().replace(/^projects\//, "").toLowerCase();
  // Cloud project IDs: 6–30 chars, lowercase letters, digits and hyphens,
  // starting with a letter and not ending with a hyphen.
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id) ? id : null;
}

/** The researcher's own Earth Engine project, saved in this browser. */
export function getUserProjectId(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem(PROJECT_STORAGE_KEY);
    return stored ? normalizeProjectId(stored) : null;
  } catch {
    return null;
  }
}

export function saveUserProjectId(id: string | null): void {
  try {
    if (id) globalThis.localStorage?.setItem(PROJECT_STORAGE_KEY, id);
    else globalThis.localStorage?.removeItem(PROJECT_STORAGE_KEY);
  } catch {
    // Without storage the project lasts for this page only.
  }
}

/** Project used for Earth Engine requests: the researcher's own, else the build default. */
export function getGeeProjectId(): string | null {
  return getUserProjectId() ?? getDefaultProjectId();
}

export function getGeeClientId(): string | null {
  const value = import.meta.env.VITE_GEE_CLIENT_ID;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The deployment can offer Google sign-in. The project is supplied by each
 * researcher at runtime, so only the OAuth client ID is required here.
 */
export function isConfigured(): boolean {
  return getGeeClientId() !== null;
}

export function resolveYear(date?: string): number {
  if (!date) return ALPHAEARTH.lastYear;
  const match = /^(\d{4})/.exec(date);
  if (!match) return ALPHAEARTH.lastYear;
  const year = Number(match[1]);
  return Math.max(ALPHAEARTH.firstYear, Math.min(ALPHAEARTH.lastYear, year));
}