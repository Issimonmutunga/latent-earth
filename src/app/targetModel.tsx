import { createContext, useContext, useMemo } from "react";
import { useWorkspace } from "./workspace.tsx";
import { matchTargetToSample, sampleSpacing, type TargetMatch } from "../analysis/target.ts";
import { predictLabels, predictValues } from "../analysis/supervised.ts";

export const KNN_K = 5;

export interface TargetModel {
  kind: "label" | "value";
  match: TargetMatch;
  /** Sorted class names (label targets only). */
  classes: string[];
  /** Range of the real target values (value targets only). */
  range: { min: number; max: number } | null;
  /** k-NN prediction for every sampled point, from the labeled points. */
  predicted: Map<string, string | number> | null;
}

const TargetModelContext = createContext<TargetModel | null>(null);

/** Computes the target model once for the whole workspace. */
export function TargetModelProvider({ children }: { children: React.ReactNode }) {
  const model = useComputedTargetModel();
  return <TargetModelContext.Provider value={model}>{children}</TargetModelContext.Provider>;
}

export function useTargetModel(): TargetModel | null {
  return useContext(TargetModelContext);
}

/**
 * Joins the attached target to the loaded sample and, when there is enough
 * labeled data, predicts the target for every other sampled point.
 */
function useComputedTargetModel(): TargetModel | null {
  const { state } = useWorkspace();
  const { target, sample, area } = state;

  return useMemo(() => {
    if (!target || !sample) return null;
    const bounds = sample.query.bounds ?? area;
    // Manual labels sit exactly on sampled points; uploads are allowed up to
    // one grid cell away so a sparse ground-truth file still lines up.
    const radius = bounds ? sampleSpacing(bounds, sample.points.length) : 0.01;
    const match = matchTargetToSample(target.rows, sample.points, radius);

    const labeled = sample.points.filter((p) => match.byPoint.has(p.id));
    const vectors = labeled.map((p) => p.vector);
    const queries = sample.points.map((p) => p.vector);
    let predicted: Map<string, string | number> | null = null;
    let classes: string[] = [];
    let range: TargetModel["range"] = null;

    if (target.kind === "label") {
      const labels = labeled.map((p) => match.byPoint.get(p.id)!.label!);
      classes = [...new Set(labels)].sort();
      if (labeled.length >= 1 && classes.length >= 1) {
        const out = predictLabels(vectors, labels, queries, KNN_K);
        predicted = new Map(sample.points.map((p, i) => [p.id, out[i]]));
      }
    } else {
      const values = labeled.map((p) => match.byPoint.get(p.id)!.value!);
      if (values.length) range = { min: Math.min(...values), max: Math.max(...values) };
      if (labeled.length >= 2) {
        const out = predictValues(vectors, values, queries, KNN_K);
        predicted = new Map(sample.points.map((p, i) => [p.id, out[i]]));
      }
    }
    return { kind: target.kind, match, classes, range, predicted };
  }, [target, sample, area]);
}
