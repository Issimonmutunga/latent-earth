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

export function getGeeProjectId(): string | null {
  const value = import.meta.env.VITE_GEE_PROJECT_ID;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function getGeeClientId(): string | null {
  const value = import.meta.env.VITE_GEE_CLIENT_ID;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function isConfigured(): boolean {
  return getGeeProjectId() !== null && getGeeClientId() !== null;
}

export function resolveYear(date?: string): number {
  if (!date) return ALPHAEARTH.lastYear;
  const match = /^(\d{4})/.exec(date);
  if (!match) return ALPHAEARTH.lastYear;
  const year = Number(match[1]);
  return Math.max(ALPHAEARTH.firstYear, Math.min(ALPHAEARTH.lastYear, year));
}