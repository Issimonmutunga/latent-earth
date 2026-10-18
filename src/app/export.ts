import type { EmbeddingResult, EmbeddingSource } from "../types/embedding.ts";

/** Per-point annotations that travel with an export. */
export interface ExportColumns {
  cluster?: Map<string, number>;
  similarity?: Map<string, number>;
  target?: Map<string, string | number>;
  predicted?: Map<string, string | number>;
}

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sampleToCsv(sample: EmbeddingResult, extra: ExportColumns): string {
  const dims = sample.points[0]?.vector.length ?? 0;
  const header = [
    "id",
    "lat",
    "lon",
    "date",
    ...(extra.cluster ? ["cluster"] : []),
    ...(extra.similarity ? ["similarity"] : []),
    ...(extra.target ? ["target"] : []),
    ...(extra.predicted ? ["predicted"] : []),
    ...Array.from({ length: dims }, (_, i) => `e${String(i).padStart(2, "0")}`),
  ];
  const lines = [header.join(",")];
  for (const p of sample.points) {
    const row: unknown[] = [p.id, p.lat.toFixed(6), p.lon.toFixed(6), p.date ?? ""];
    if (extra.cluster) row.push(extra.cluster.has(p.id) ? extra.cluster.get(p.id)! + 1 : "");
    if (extra.similarity) row.push(extra.similarity.get(p.id)?.toFixed(5));
    if (extra.target) row.push(extra.target.get(p.id));
    if (extra.predicted) row.push(extra.predicted.get(p.id));
    for (const v of p.vector) row.push(v.toPrecision(6));
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
}

export function sampleToGeoJson(sample: EmbeddingResult, extra: ExportColumns, includeVectors: boolean): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: sample.points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        date: p.date,
        cluster: extra.cluster?.has(p.id) ? extra.cluster.get(p.id)! + 1 : undefined,
        similarity: extra.similarity?.get(p.id),
        target: extra.target?.get(p.id),
        predicted: extra.predicted?.get(p.id),
        ...(includeVectors ? { embedding: Array.from(p.vector) } : {}),
      },
    })),
  });
}

export function sessionSummary(
  source: EmbeddingSource | null,
  sample: EmbeddingResult,
  notes: string[],
): string {
  const b = sample.query.bounds;
  return [
    "Latent Earth session",
    `Source: ${source?.name ?? sample.sourceId} (${source?.dimensions ?? "?"} dims, ${source?.spatialResolution ?? "?"} m)`,
    `Area (W,S,E,N): ${b.west.toFixed(4)}, ${b.south.toFixed(4)}, ${b.east.toFixed(4)}, ${b.north.toFixed(4)}`,
    `Sample: ${sample.points.length} of ${sample.requested} points${sample.query.date ? `, year ${sample.query.date}` : ""}`,
    `Retrieved: ${new Date(sample.retrievedAt).toISOString()}`,
    ...notes,
    ...(sample.note ? [sample.note] : []),
  ].join("\n");
}

export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
