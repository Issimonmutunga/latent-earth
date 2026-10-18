import type { BoundingBox, EmbeddingPoint, TargetRow } from "../types/embedding.ts";

/**
 * Parsing and joining of researcher-supplied ground truth. Nothing here ever
 * invents values: invalid rows are reported with a reason, never defaulted.
 */

export interface ParsedTable {
  /** Candidate attribute columns (everything except the coordinates). */
  columns: string[];
  records: Array<{ lat: number; lon: number; props: Record<string, string> }>;
  errors: string[];
  totalRows: number;
}

const LAT_KEYS = ["lat", "latitude", "y"];
const LON_KEYS = ["lon", "lng", "long", "longitude", "x"];

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function validCoord(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "coordinates are not numbers";
  if (lat < -90 || lat > 90) return `latitude ${lat} is outside −90…90`;
  if (lon < -180 || lon > 180) return `longitude ${lon} is outside −180…180`;
  return null;
}

export function parseCsv(text: string): ParsedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: string[] = [];
  if (lines.length < 2) {
    return { columns: [], records: [], errors: ["The file needs a header row and at least one data row."], totalRows: 0 };
  }
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    lines[0].split(d).length > lines[0].split(best).length ? d : best,
  );
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.replace(/^﻿/, ""));
  const lower = header.map((h) => h.toLowerCase());
  const latIdx = lower.findIndex((h) => LAT_KEYS.includes(h));
  const lonIdx = lower.findIndex((h) => LON_KEYS.includes(h));
  if (latIdx < 0 || lonIdx < 0) {
    return {
      columns: [],
      records: [],
      errors: [
        `Could not find coordinate columns. Name them "lat" and "lon" (found: ${header.join(", ")}).`,
      ],
      totalRows: lines.length - 1,
    };
  }
  const columns = header.filter((_, i) => i !== latIdx && i !== lonIdx);
  const records: ParsedTable["records"] = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cells = splitCsvLine(lines[r], delimiter);
    const lat = Number(cells[latIdx]);
    const lon = Number(cells[lonIdx]);
    const problem = validCoord(lat, lon);
    if (problem) {
      errors.push(`Row ${r + 1}: ${problem}.`);
      continue;
    }
    const props: Record<string, string> = {};
    header.forEach((h, i) => {
      if (i !== latIdx && i !== lonIdx) props[h] = cells[i] ?? "";
    });
    records.push({ lat, lon, props });
  }
  return { columns, records, errors, totalRows: lines.length - 1 };
}

export function parseGeoJson(text: string): ParsedTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { columns: [], records: [], errors: ["The file is not valid JSON."], totalRows: 0 };
  }
  const features =
    data && typeof data === "object" && Array.isArray((data as { features?: unknown }).features)
      ? ((data as { features: unknown[] }).features)
      : null;
  if (!features) {
    return { columns: [], records: [], errors: ["Expected a GeoJSON FeatureCollection."], totalRows: 0 };
  }
  const errors: string[] = [];
  const columns = new Set<string>();
  const records: ParsedTable["records"] = [];
  features.forEach((f, i) => {
    const feature = f as { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    if (feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) {
      errors.push(`Feature ${i + 1}: only Point geometries are supported.`);
      return;
    }
    const [lon, lat] = feature.geometry.coordinates as number[];
    const problem = validCoord(Number(lat), Number(lon));
    if (problem) {
      errors.push(`Feature ${i + 1}: ${problem}.`);
      return;
    }
    const props: Record<string, string> = {};
    for (const [k, v] of Object.entries(feature.properties ?? {})) {
      if (v === null || typeof v === "object") continue;
      props[k] = String(v);
      columns.add(k);
    }
    records.push({ lat: Number(lat), lon: Number(lon), props });
  });
  return { columns: [...columns], records, errors, totalRows: features.length };
}

export function parseTargetFile(text: string, filename: string): ParsedTable {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".geojson") || text.trimStart().startsWith("{")) {
    return parseGeoJson(text);
  }
  return parseCsv(text);
}

/** Pick the most likely target column: prefer conventional names, then the first column. */
export function guessTargetColumn(table: ParsedTable): string | null {
  const preferred = ["label", "class", "value", "target", "y", "landcover", "category"];
  for (const name of preferred) {
    const hit = table.columns.find((c) => c.toLowerCase() === name);
    if (hit) return hit;
  }
  return table.columns[0] ?? null;
}

/**
 * Turn one attribute column into target rows. A column whose every non-empty
 * value is numeric becomes a numeric target; otherwise it is categorical.
 * Rows with an empty cell are reported, not filled.
 */
export function buildTargetRows(
  table: ParsedTable,
  column: string,
): { kind: "label" | "value"; rows: TargetRow[]; skipped: number } {
  const present = table.records.filter((r) => (r.props[column] ?? "").trim() !== "");
  const numeric = present.length > 0 && present.every((r) => Number.isFinite(Number(r.props[column])));
  const distinct = new Set(present.map((r) => r.props[column].trim()));
  // Few distinct integer codes (e.g. land-cover classes) are categories, not quantities.
  const fractional = [...distinct].some((v) => !Number.isInteger(Number(v)));
  const kind: "label" | "value" = numeric && (distinct.size > 10 || fractional) ? "value" : "label";
  const rows: TargetRow[] = present.map((r) =>
    kind === "value"
      ? { lat: r.lat, lon: r.lon, value: Number(r.props[column]) }
      : { lat: r.lat, lon: r.lon, label: r.props[column].trim() },
  );
  return { kind, rows, skipped: table.records.length - present.length };
}

export interface TargetMatch {
  /** pointId -> ground truth joined to that sampled point */
  byPoint: Map<string, { label?: string; value?: number }>;
  matchedRows: number;
  unmatchedRows: number;
}

/** Typical spacing between sampled points, in degrees. */
export function sampleSpacing(bounds: BoundingBox, n: number): number {
  const w = Math.max(1e-9, bounds.east - bounds.west);
  const h = Math.max(1e-9, bounds.north - bounds.south);
  return Math.sqrt((w * h) / Math.max(1, n));
}

/**
 * Join each target row to its nearest sampled point, if one lies within
 * `maxDistanceDeg`. When several rows land on the same point, the closest wins.
 */
export function matchTargetToSample(
  rows: TargetRow[],
  points: EmbeddingPoint[],
  maxDistanceDeg: number,
): TargetMatch {
  const best = new Map<string, { d: number; row: TargetRow }>();
  let matchedRows = 0;
  const max2 = maxDistanceDeg * maxDistanceDeg;
  for (const row of rows) {
    const cos = Math.cos((row.lat * Math.PI) / 180);
    let bestId: string | null = null;
    let bestD = Infinity;
    for (const p of points) {
      const dx = (p.lon - row.lon) * cos;
      const dy = p.lat - row.lat;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestId = p.id;
      }
    }
    if (bestId === null || bestD > max2) continue;
    matchedRows += 1;
    const prev = best.get(bestId);
    if (!prev || bestD < prev.d) best.set(bestId, { d: bestD, row });
  }
  const byPoint = new Map<string, { label?: string; value?: number }>();
  for (const [id, { row }] of best) byPoint.set(id, { label: row.label, value: row.value });
  return { byPoint, matchedRows, unmatchedRows: rows.length - matchedRows };
}
