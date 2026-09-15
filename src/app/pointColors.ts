import { useMemo } from "react";
import { useWorkspace } from "./workspace.tsx";
import { rankBySimilarity } from "../analysis/similarity.ts";
import { categorical, viridis } from "../visualization/colors.ts";

/**
 * Derives the shared point coloring (the same scale is used by Map, Embedding,
 * Similarity and Analysis views). Returns a map of point id -> hex color, or
 * null when the neutral channel is active.
 */
export function usePointColors(): Map<string, string> | null {
  const { state } = useWorkspace();
  const { sample, queryPointId, clusters, colorBasis } = state;

  return useMemo(() => {
    if (!sample) return null;

    if (colorBasis === "cluster" && clusters) {
      const out = new Map<string, string>();
      sample.points.forEach((p, i) => {
        if (i < clusters.assignments.length) out.set(p.id, categorical(clusters.assignments[i]));
      });
      return out;
    }

    if (colorBasis === "similarity" && queryPointId) {
      const query = sample.points.find((p) => p.id === queryPointId);
      if (!query) return null;
      const out = new Map<string, string>();
      for (const { point, similarity } of rankBySimilarity(sample.points, query)) {
        out.set(point.id, viridis((similarity + 1) / 2));
      }
      return out;
    }

    return null;
  }, [sample, clusters, colorBasis, queryPointId]);
}