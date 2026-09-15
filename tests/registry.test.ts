import { beforeEach, describe, expect, it } from "vitest";
import { availableSources, embeddingRegistry, getSource } from "../src/embeddings/registry/sources.ts";
import { createMockSource } from "../src/embeddings/mock/mockSource.ts";

const env = import.meta.env as Record<string, string | undefined>;

beforeEach(() => {
  delete env.VITE_GEE_PROJECT_ID;
  delete env.VITE_GEE_CLIENT_ID;
});

describe("embedding registry", () => {
  it("lists the initial sources without fabricated implementations", () => {
    const ids = embeddingRegistry.map((s) => s.id);
    expect(ids).toEqual(["alphaearth", "tessera", "clay"]);
    for (const s of embeddingRegistry) {
      expect(s.status).toBe("integration-pending");
    }
  });

  it("reports no available sources until verified", () => {
    expect(availableSources()).toHaveLength(0);
  });

  it("resolves sources by id", () => {
    expect(getSource("alphaearth")?.name).toBe("AlphaEarth");
    expect(getSource("nope")).toBeUndefined();
  });

  it("never registers the dev mock source in the production registry", () => {
    expect(embeddingRegistry.some((s) => s.id === "mock")).toBe(false);
  });

  it("mock source rejects non-integration claims by labelling itself", () => {
    const mock = createMockSource(8);
    expect(mock.status).toBe("mock-only");
  });
});