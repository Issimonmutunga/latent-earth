import { afterEach, describe, expect, it } from "vitest";
import {
  ALPHAEARTH,
  getGeeClientId,
  getGeeProjectId,
  isConfigured,
  resolveYear,
} from "../src/embeddings/gee/config.ts";

const env = import.meta.env as { VITE_GEE_PROJECT_ID?: string; VITE_GEE_CLIENT_ID?: string };

afterEach(() => {
  delete env.VITE_GEE_PROJECT_ID;
  delete env.VITE_GEE_CLIENT_ID;
});

describe("alphaearth dataset config", () => {
  it("defines the 64 named bands from A00 to A63", () => {
    expect(ALPHAEARTH.bands).toHaveLength(64);
    expect(ALPHAEARTH.bands[0]).toBe("A00");
    expect(ALPHAEARTH.bands[63]).toBe("A63");
  });

  it("identifies the Earth Engine catalogue entry", () => {
    expect(ALPHAEARTH.collectionId).toBe("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL");
    expect(ALPHAEARTH.spatialResolution).toBe(10);
    expect(ALPHAEARTH.firstYear).toBe(2017);
    expect(ALPHAEARTH.lastYear).toBe(2025);
  });

  it("carries the required dataset attribution", () => {
    expect(ALPHAEARTH.attribution).toMatch(/produced by Google and Google DeepMind/);
  });

  it("is not configured without a project id and client id", () => {
    delete env.VITE_GEE_PROJECT_ID;
    delete env.VITE_GEE_CLIENT_ID;
    expect(isConfigured()).toBe(false);
    expect(getGeeProjectId()).toBeNull();
    expect(getGeeClientId()).toBeNull();
  });

  it("is not configured when only the project id is set", () => {
    env.VITE_GEE_PROJECT_ID = "ee-my-project";
    delete env.VITE_GEE_CLIENT_ID;
    expect(getGeeProjectId()).toBe("ee-my-project");
    expect(isConfigured()).toBe(false);
  });

  it("is not configured when only the client id is set", () => {
    delete env.VITE_GEE_PROJECT_ID;
    env.VITE_GEE_CLIENT_ID = "my-client-id.apps.googleusercontent.com";
    expect(getGeeClientId()).toBe("my-client-id.apps.googleusercontent.com");
    expect(isConfigured()).toBe(false);
  });

  it("is configured when a project id and client id are set", () => {
    env.VITE_GEE_PROJECT_ID = "  ee-my-project  ";
    env.VITE_GEE_CLIENT_ID = "  my-client-id.apps.googleusercontent.com  ";
    expect(getGeeProjectId()).toBe("ee-my-project");
    expect(getGeeClientId()).toBe("my-client-id.apps.googleusercontent.com");
    expect(isConfigured()).toBe(true);
  });

  it("clamps requested years to the available range", () => {
    expect(resolveYear()).toBe(ALPHAEARTH.lastYear);
    expect(resolveYear("2015")).toBe(ALPHAEARTH.firstYear);
    expect(resolveYear("2030")).toBe(ALPHAEARTH.lastYear);
    expect(resolveYear("2021-07-03")).toBe(2021);
    expect(resolveYear("nonsense")).toBe(ALPHAEARTH.lastYear);
  });
});