import { describe, expect, it } from "vitest";
import {
  buildTargetRows,
  guessTargetColumn,
  matchTargetToSample,
  parseCsv,
  parseGeoJson,
} from "../src/analysis/target.ts";
import type { EmbeddingPoint } from "../src/types/embedding.ts";

const pt = (id: string, lon: number, lat: number): EmbeddingPoint => ({
  id,
  lon,
  lat,
  vector: new Float32Array([0]),
});

describe("target parsing", () => {
  it("parses CSV with lat/lon and reports invalid rows", () => {
    const table = parseCsv("lat,lon,class\n1,2,water\n95,2,urban\n3,4,urban\n");
    expect(table.records).toHaveLength(2);
    expect(table.errors).toEqual(["Row 3: latitude 95 is outside −90…90."]);
    expect(table.columns).toEqual(["class"]);
    expect(guessTargetColumn(table)).toBe("class");
  });

  it("explains missing coordinate columns", () => {
    const table = parseCsv("a,b\n1,2\n");
    expect(table.records).toHaveLength(0);
    expect(table.errors[0]).toMatch(/coordinate columns/);
  });

  it("handles quoted cells and semicolons", () => {
    const table = parseCsv('latitude;longitude;name\n1;2;"a; b"\n');
    expect(table.records[0].props.name).toBe("a; b");
  });

  it("parses GeoJSON points", () => {
    const table = parseGeoJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [10, 20] }, properties: { v: 1.5 } },
          { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} },
        ],
      }),
    );
    expect(table.records).toEqual([{ lat: 20, lon: 10, props: { v: "1.5" } }]);
    expect(table.errors).toHaveLength(1);
  });

  it("treats fractional numbers as values and small integer codes as labels", () => {
    const values = buildTargetRows(parseCsv("lat,lon,ndvi\n0,0,0.4\n1,1,0.7\n"), "ndvi");
    expect(values.kind).toBe("value");
    expect(values.rows[1].value).toBe(0.7);
    const codes = buildTargetRows(parseCsv("lat,lon,lc\n0,0,1\n1,1,2\n2,2,\n"), "lc");
    expect(codes.kind).toBe("label");
    expect(codes.skipped).toBe(1);
  });
});

describe("matchTargetToSample", () => {
  it("joins rows to the nearest point within range and keeps the closest", () => {
    const points = [pt("a", 0, 0), pt("b", 1, 0)];
    const match = matchTargetToSample(
      [
        { lat: 0, lon: 0.1, label: "x" },
        { lat: 0, lon: 0.01, label: "y" },
        { lat: 0, lon: 5, label: "far" },
      ],
      points,
      0.5,
    );
    expect(match.byPoint.get("a")).toEqual({ label: "y", value: undefined });
    expect(match.byPoint.has("b")).toBe(false);
    expect(match.matchedRows).toBe(2);
    expect(match.unmatchedRows).toBe(1);
  });
});
