import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from "react";
import type {
  BoundingBox,
  EmbeddingResult,
  EmbeddingSource,
  RetrievalStatus,
  Target,
  TargetRow,
  ViewMode,
} from "../types/embedding.ts";
import { embeddingRegistry } from "../embeddings/registry/sources.ts";
import { createMockSource } from "../embeddings/mock/mockSource.ts";
import {
  connectEarthEngine,
  getEarthEngineError,
  getEarthEngineProject,
  getEarthEngineStatus,
  NO_PROJECT_MESSAGE,
  prepareEarthEngine,
} from "../embeddings/gee/connection.ts";
import { kmeans } from "../analysis/clustering.ts";

/**
 * Sources available to this build. The mock source is registered only in
 * development builds, never in production, so the shipped product can only
 * ever display real provider data.
 */
export function buildSourceList(): EmbeddingSource[] {
  const sources = [...embeddingRegistry];
  if (import.meta.env.DEV) {
    sources.push(createMockSource());
  }
  return sources;
}

export interface ClusterLayer {
  assignments: Uint8Array;
  k: number;
}

export type ColorBasis = "neutral" | "cluster" | "similarity" | "target";

/** A one-shot camera request for the map (bumped `n` re-triggers it). */
export type MapRequest =
  | { kind: "fit"; bounds: BoundingBox; n: number }
  | { kind: "point"; lon: number; lat: number; n: number };

export const MAX_PINNED = 5;

/** Sections of the in-app guide. */
export type GuideSection = "welcome" | "quickstart" | "setup" | "using" | "results" | "troubleshooting";

/** Control-bar step whose popover is open. */
export type StepId = "source" | "area" | "sample" | "target";

export interface WorkspaceState {
  sources: EmbeddingSource[];
  source: EmbeddingSource | null;
  area: BoundingBox | null;
  sampleSize: number;
  year: number | null;
  target: Target | null;
  sample: EmbeddingResult | null;
  status: RetrievalStatus;
  sampleIsStale: boolean;
  view: ViewMode;
  drawing: boolean;
  selectedPointId: string | null;
  hoveredPointId: string | null;
  queryPointId: string | null;
  pinnedIds: string[];
  inspectorOpen: boolean;
  clusters: ClusterLayer | null;
  colorBasis: ColorBasis;
  mapRequest: MapRequest | null;
  toast: { text: string; n: number } | null;
  openStep: StepId | null;
  guide: GuideSection | null;
}

type Action =
  | { type: "select-source"; source: EmbeddingSource }
  | { type: "set-area"; area: BoundingBox; fly: boolean }
  | { type: "clear-area" }
  | { type: "set-sample-size"; size: number }
  | { type: "set-year"; year: number | null }
  | { type: "start-drawing" }
  | { type: "stop-drawing" }
  | { type: "retrieve-start"; requested: number }
  | { type: "retrieve-success"; result: EmbeddingResult }
  | { type: "retrieve-zero" }
  | { type: "retrieve-error"; message: string }
  | { type: "set-view"; view: ViewMode }
  | { type: "select-point"; id: string | null }
  | { type: "hover-point"; id: string | null }
  | { type: "set-query-point"; id: string | null }
  | { type: "toggle-pin"; id: string }
  | { type: "toggle-inspector" }
  | { type: "set-clusters"; clusters: ClusterLayer }
  | { type: "clear-clusters" }
  | { type: "set-color-basis"; basis: ColorBasis }
  | { type: "set-target"; target: Target }
  | { type: "clear-target" }
  | { type: "label-point"; row: TargetRow; label: string | null }
  | { type: "fly-to-point"; id: string }
  | { type: "toast"; text: string }
  | { type: "open-step"; step: StepId | null }
  | { type: "open-guide"; section: GuideSection | null };

const initialState: WorkspaceState = {
  sources: buildSourceList(),
  source: null,
  area: null,
  sampleSize: 500,
  year: null,
  target: null,
  sample: null,
  status: { kind: "idle" },
  sampleIsStale: false,
  view: "map",
  drawing: false,
  selectedPointId: null,
  hoveredPointId: null,
  queryPointId: null,
  pinnedIds: [],
  inspectorOpen: false,
  clusters: null,
  colorBasis: "neutral",
  mapRequest: null,
  toast: null,
  openStep: null,
  guide: null,
};

/** Color basis to fall back to when the current one loses its data. */
function fallbackBasis(state: WorkspaceState): ColorBasis {
  if (state.clusters) return "cluster";
  return "neutral";
}

function sameRow(a: TargetRow, b: TargetRow): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9;
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  const nextN = (state.mapRequest?.n ?? 0) + 1;
  switch (action.type) {
    case "select-source":
      return {
        ...state,
        source: action.source,
        year: null,
        sample: null,
        sampleIsStale: false,
        status: { kind: "idle" },
        view: "map",
        selectedPointId: null,
        queryPointId: null,
        pinnedIds: [],
        clusters: null,
        colorBasis: "neutral",
      };
    case "set-area":
      return {
        ...state,
        area: action.area,
        drawing: false,
        sampleIsStale: state.sample !== null,
        status: state.status.kind === "retrieving" ? state.status : { kind: "idle" },
        mapRequest: action.fly ? { kind: "fit", bounds: action.area, n: nextN } : state.mapRequest,
      };
    case "clear-area":
      return { ...state, area: null, sampleIsStale: state.sample !== null };
    case "set-sample-size":
      return {
        ...state,
        sampleSize: action.size,
        sampleIsStale: state.sample !== null && action.size !== state.sample.requested,
      };
    case "set-year":
      return { ...state, year: action.year, sampleIsStale: state.sample !== null };
    case "start-drawing":
      return { ...state, drawing: true, view: "map", openStep: null };
    case "stop-drawing":
      return { ...state, drawing: false };
    case "retrieve-start":
      return { ...state, drawing: false, status: { kind: "retrieving", requested: action.requested } };
    case "retrieve-success":
      return {
        ...state,
        sample: action.result,
        sampleIsStale: false,
        status: { kind: "ready" },
        selectedPointId: null,
        queryPointId: null,
        pinnedIds: [],
        inspectorOpen: false,
        clusters: null,
        colorBasis: state.target ? "target" : "neutral",
      };
    case "retrieve-zero":
      return { ...state, sample: null, status: { kind: "zero-results" } };
    case "retrieve-error":
      return { ...state, status: { kind: "error", message: action.message } };
    case "set-view":
      return { ...state, view: action.view, drawing: action.view === "map" ? state.drawing : false };
    case "select-point":
      return { ...state, selectedPointId: action.id, inspectorOpen: action.id !== null };
    case "hover-point":
      return { ...state, hoveredPointId: action.id };
    case "set-query-point":
      return {
        ...state,
        queryPointId: action.id,
        colorBasis: action.id ? "similarity" : state.colorBasis === "similarity" ? fallbackBasis(state) : state.colorBasis,
      };
    case "toggle-pin": {
      const pinned = state.pinnedIds.includes(action.id)
        ? state.pinnedIds.filter((id) => id !== action.id)
        : [...state.pinnedIds, action.id].slice(-MAX_PINNED);
      return { ...state, pinnedIds: pinned };
    }
    case "toggle-inspector":
      return { ...state, inspectorOpen: !state.inspectorOpen };
    case "set-clusters":
      return { ...state, clusters: action.clusters, colorBasis: "cluster" };
    case "clear-clusters":
      return {
        ...state,
        clusters: null,
        colorBasis: state.colorBasis === "cluster" ? "neutral" : state.colorBasis,
      };
    case "set-color-basis":
      return { ...state, colorBasis: action.basis };
    case "set-target":
      return { ...state, target: action.target, colorBasis: "target" };
    case "clear-target":
      return {
        ...state,
        target: null,
        colorBasis: state.colorBasis === "target" ? fallbackBasis(state) : state.colorBasis,
      };
    case "label-point": {
      const base: Target =
        state.target && state.target.kind === "label"
          ? state.target
          : { id: `manual-${Date.now()}`, name: "Manual labels", kind: "label", origin: "manual", rows: [] };
      const rows = base.rows.filter((r) => !sameRow(r, action.row));
      if (action.label) rows.push({ ...action.row, label: action.label });
      if (rows.length === 0) {
        return {
          ...state,
          target: null,
          colorBasis: state.colorBasis === "target" ? fallbackBasis(state) : state.colorBasis,
        };
      }
      return { ...state, target: { ...base, rows } };
    }
    case "fly-to-point": {
      const p = state.sample?.points.find((pt) => pt.id === action.id);
      if (!p) return state;
      return {
        ...state,
        view: "map",
        selectedPointId: p.id,
        inspectorOpen: true,
        mapRequest: { kind: "point", lon: p.lon, lat: p.lat, n: nextN },
      };
    }
    case "open-step":
      return { ...state, openStep: action.step };
    case "open-guide":
      return { ...state, guide: action.section, openStep: action.section ? null : state.openStep };
    case "toast":
      return { ...state, toast: { text: action.text, n: (state.toast?.n ?? 0) + 1 } };
    default:
      return state;
  }
}

export interface WorkspaceApi {
  state: WorkspaceState;
  selectSource: (source: EmbeddingSource) => void;
  setArea: (area: BoundingBox, options?: { fly?: boolean }) => void;
  clearArea: () => void;
  setSampleSize: (size: number) => void;
  setYear: (year: number | null) => void;
  startDrawing: () => void;
  stopDrawing: () => void;
  retrieveSample: () => Promise<void>;
  setView: (view: ViewMode) => void;
  selectPoint: (id: string | null) => void;
  setHoveredPoint: (id: string | null) => void;
  setQueryPoint: (id: string | null) => void;
  togglePin: (id: string) => void;
  toggleInspector: () => void;
  runClustering: (k: number) => void;
  clearClusters: () => void;
  setColorBasis: (basis: ColorBasis) => void;
  setTarget: (target: Target) => void;
  clearTarget: () => void;
  labelPoint: (id: string, label: string | null) => void;
  flyToPoint: (id: string) => void;
  notify: (text: string) => void;
  setOpenStep: (step: StepId | null) => void;
  openGuide: (section: GuideSection | null) => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Callbacks read the latest state through a ref so their identity stays stable.
  const stateRef = useRef(state);
  stateRef.current = state;

  const selectSource = useCallback((source: EmbeddingSource) => {
    dispatch({ type: "select-source", source });
    // Load Google sign-in now so the later Retrieve click can open its popup.
    if (source.providerConnection === "earth-engine") void prepareEarthEngine().catch(() => {});
  }, []);

  const setArea = useCallback((area: BoundingBox, options?: { fly?: boolean }) => {
    dispatch({ type: "set-area", area, fly: options?.fly ?? false });
  }, []);
  const clearArea = useCallback(() => dispatch({ type: "clear-area" }), []);
  const setSampleSize = useCallback((size: number) => dispatch({ type: "set-sample-size", size }), []);
  const setYear = useCallback((year: number | null) => dispatch({ type: "set-year", year }), []);

  const startDrawing = useCallback(() => dispatch({ type: "start-drawing" }), []);
  const stopDrawing = useCallback(() => dispatch({ type: "stop-drawing" }), []);

  const retrieveSample = useCallback(async () => {
    const { source, area, sampleSize, year, status } = stateRef.current;
    if (!source || !area || status.kind === "retrieving") return;
    // Sign in on the researcher's behalf so Retrieve is a single click. This
    // must start before any await so Google's popup counts as part of the click.
    if (source.providerConnection === "earth-engine" && !getEarthEngineProject()) {
      dispatch({ type: "retrieve-error", message: NO_PROJECT_MESSAGE });
      dispatch({ type: "open-step", step: "source" });
      return;
    }
    const needsSignIn =
      source.providerConnection === "earth-engine" && getEarthEngineStatus() !== "connected";
    const signIn = needsSignIn ? connectEarthEngine() : null;
    dispatch({ type: "retrieve-start", requested: sampleSize });
    try {
      if (signIn && !(await signIn)) {
        dispatch({
          type: "retrieve-error",
          message: getEarthEngineError() ?? "Sign in with Google to read AlphaEarth, then retrieve again.",
        });
        return;
      }
      const result = await source.query({
        bounds: area,
        sampleSize,
        date: year ? String(year) : undefined,
      });
      if (result.points.length === 0) {
        dispatch({ type: "retrieve-zero" });
        return;
      }
      dispatch({ type: "retrieve-success", result });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The embedding source could not be reached.";
      dispatch({ type: "retrieve-error", message });
    }
  }, []);

  const setView = useCallback((view: ViewMode) => dispatch({ type: "set-view", view }), []);
  const selectPoint = useCallback((id: string | null) => dispatch({ type: "select-point", id }), []);
  const setHoveredPoint = useCallback((id: string | null) => dispatch({ type: "hover-point", id }), []);
  const setQueryPoint = useCallback(
    (id: string | null) => dispatch({ type: "set-query-point", id }),
    [],
  );
  const togglePin = useCallback((id: string) => dispatch({ type: "toggle-pin", id }), []);
  const toggleInspector = useCallback(() => dispatch({ type: "toggle-inspector" }), []);
  const runClustering = useCallback((k: number) => {
    const sample = stateRef.current.sample;
    if (!sample || sample.points.length < k) return;
    const result = kmeans(sample.points.map((p) => p.vector), k);
    dispatch({ type: "set-clusters", clusters: { assignments: result.assignments, k } });
  }, []);
  const clearClusters = useCallback(() => dispatch({ type: "clear-clusters" }), []);
  const setColorBasis = useCallback(
    (basis: ColorBasis) => dispatch({ type: "set-color-basis", basis }),
    [],
  );
  const setTarget = useCallback((target: Target) => dispatch({ type: "set-target", target }), []);
  const clearTarget = useCallback(() => dispatch({ type: "clear-target" }), []);
  const labelPoint = useCallback((id: string, label: string | null) => {
    const p = stateRef.current.sample?.points.find((pt) => pt.id === id);
    if (!p) return;
    dispatch({ type: "label-point", row: { lat: p.lat, lon: p.lon }, label });
  }, []);
  const flyToPoint = useCallback((id: string) => dispatch({ type: "fly-to-point", id }), []);
  const notify = useCallback((text: string) => dispatch({ type: "toast", text }), []);
  const setOpenStep = useCallback((step: StepId | null) => dispatch({ type: "open-step", step }), []);
  const openGuide = useCallback(
    (section: GuideSection | null) => dispatch({ type: "open-guide", section }),
    [],
  );

  const api: WorkspaceApi = useMemo(
    () => ({
      state,
      selectSource,
      setArea,
      clearArea,
      setSampleSize,
      setYear,
      startDrawing,
      stopDrawing,
      retrieveSample,
      setView,
      selectPoint,
      setHoveredPoint,
      setQueryPoint,
      togglePin,
      toggleInspector,
      runClustering,
      clearClusters,
      setColorBasis,
      setTarget,
      clearTarget,
      labelPoint,
      flyToPoint,
      notify,
      setOpenStep,
      openGuide,
    }),
    [
      state,
      selectSource,
      setArea,
      clearArea,
      setSampleSize,
      setYear,
      startDrawing,
      stopDrawing,
      retrieveSample,
      setView,
      selectPoint,
      setHoveredPoint,
      setQueryPoint,
      togglePin,
      toggleInspector,
      runClustering,
      clearClusters,
      setColorBasis,
      setTarget,
      clearTarget,
      labelPoint,
      flyToPoint,
      notify,
      setOpenStep,
      openGuide,
    ],
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  }
  return ctx;
}
