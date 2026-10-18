import { useMemo } from "react";
import { useWorkspace } from "./workspace.tsx";
import { useTargetModel } from "./targetModel.tsx";
import { rankBySimilarity } from "../analysis/similarity.ts";
import type { ExportColumns } from "./export.ts";

/**
 * Everything currently known about each sampled point beyond its vector:
 * cluster, similarity to the query, real target value and k-NN prediction.
 * Shared by the tooltip, inspector and exports so they always agree.
 */
export function usePointAnnotations(): ExportColumns {
  const { state } = useWorkspace();
  const { sample, clusters, queryPointId } = state;
  const model = useTargetModel();

  return useMemo(() => {
    const out: ExportColumns = {};
    if (!sample) return out;
    if (clusters) {
      out.cluster = new Map(sample.points.map((p, i) => [p.id, clusters.assignments[i]]));
    }
    const query = queryPointId ? sample.points.find((p) => p.id === queryPointId) : null;
    if (query) {
      out.similarity = new Map(rankBySimilarity(sample.points, query).map((s) => [s.point.id, s.similarity]));
    }
    if (model) {
      out.target = new Map(
        [...model.match.byPoint].map(([id, t]) => [id, (t.label ?? t.value) as string | number]),
      );
      if (model.predicted) out.predicted = model.predicted;
    }
    return out;
  }, [sample, clusters, queryPointId, model]);
}

export function formatTargetValue(v: string | number | undefined): string {
  if (v === undefined) return "—";
  return typeof v === "number" ? v.toPrecision(4) : v;
}
