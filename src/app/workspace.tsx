import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type {
  BoundingBox,
  EmbeddingResult,
  EmbeddingSource,
  RetrievalStatus,
  Target,
  ViewMode,
} from "../types/embedding.ts";
import { embeddingRegistry } from "../embeddings/registry/sources.ts";
import { createMockSource } from "../embeddings/mock/mockSource.ts";

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

export type ColorBasis = "neutral" | "cluster" | "similarity";

export interface WorkspaceState {
  sources: EmbeddingSource[];
  source: EmbeddingSource | null;
  area: BoundingBox | null;
  target: Target | null;
  sample: EmbeddingResult | null;
  status: RetrievalStatus;
  sampleIsStale: boolean;
  view: ViewMode;
  drawing: boolean;
  selectedPointId: string | null;
  hoveredPointId: string | null;
  queryPointId: string | null;
  inspectorOpen: boolean;
  clusters: ClusterLayer | null;
  colorBasis: ColorBasis;
}

type Action =
  | { type: "select-source"; source: EmbeddingSource }
  | { type: "set-area"; area: BoundingBox }
  | { type: "start-drawing" }
  | { type: "stop-drawing" }
  | { type: "retrieve-start"; requested: number }
  | { type: "retrieve-success"; result: EmbeddingResult }
  | { type: "retrieve-zero" }
  | { type: "retrieve-error"; message: string }
  | { type: "mark-stale" }
  | { type: "set-view"; view: ViewMode }
  | { type: "select-point"; id: string | null }
  | { type: "hover-point"; id: string | null }
  | { type: "set-query-point"; id: string | null }
  | { type: "toggle-inspector" }
  | { type: "set-clusters"; clusters: ClusterLayer }
  | { type: "clear-clusters" }
  | { type: "set-color-basis"; basis: ColorBasis };

const initialState: WorkspaceState = {
  sources: buildSourceList(),
  source: null,
  area: null,
  target: null,
  sample: null,
  status: { kind: "idle" },
  sampleIsStale: false,
  view: "map",
  drawing: false,
  selectedPointId: null,
  hoveredPointId: null,
  queryPointId: null,
  inspectorOpen: false,
  clusters: null,
  colorBasis: "neutral",
};

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "select-source":
      return {
        ...state,
        source: action.source,
        sample: null,
        sampleIsStale: false,
        status: { kind: "idle" },
        view: "map",
        selectedPointId: null,
        queryPointId: null,
        clusters: null,
        colorBasis: "neutral",
      };
    case "set-area":
      return {
        ...state,
        area: action.area,
        sampleIsStale: state.sample !== null,
      };
    case "start-drawing":
      return { ...state, drawing: true };
    case "stop-drawing":
      return { ...state, drawing: false };
    case "retrieve-start":
      return { ...state, status: { kind: "retrieving", requested: action.requested } };
    case "retrieve-success":
      return {
        ...state,
        sample: action.result,
        sampleIsStale: false,
        status: { kind: "ready" },
        selectedPointId: null,
        queryPointId: null,
        clusters: null,
        colorBasis: "neutral",
      };
    case "retrieve-zero":
      return { ...state, sample: null, status: { kind: "zero-results" } };
    case "retrieve-error":
      return { ...state, status: { kind: "error", message: action.message } };
    case "mark-stale":
      return { ...state, sampleIsStale: true };
    case "set-view":
      return { ...state, view: action.view };
    case "select-point":
      return { ...state, selectedPointId: action.id, inspectorOpen: action.id !== null };
    case "hover-point":
      return { ...state, hoveredPointId: action.id };
    case "set-query-point":
      return { ...state, queryPointId: action.id, colorBasis: action.id ? "similarity" : action.id === null && state.clusters ? "cluster" : "neutral" };
    case "toggle-inspector":
      return { ...state, inspectorOpen: !state.inspectorOpen };
    case "set-clusters":
      return { ...state, clusters: action.clusters, colorBasis: "cluster" };
    case "clear-clusters":
      return { ...state, clusters: null, colorBasis: "neutral" };
    case "set-color-basis":
      return { ...state, colorBasis: action.basis };
    default:
      return state;
  }
}

export interface WorkspaceApi {
  state: WorkspaceState;
  selectSource: (source: EmbeddingSource) => void;
  setArea: (area: BoundingBox) => void;
  startDrawing: () => void;
  stopDrawing: () => void;
  retrieveSample: (sampleSize: number) => Promise<void>;
  setView: (view: ViewMode) => void;
  selectPoint: (id: string | null) => void;
  setHoveredPoint: (id: string | null) => void;
  setQueryPoint: (id: string | null) => void;
  toggleInspector: () => void;
  setClusters: (clusters: ClusterLayer) => void;
  clearClusters: () => void;
  setColorBasis: (basis: ColorBasis) => void;
}

interface WorkspaceContextValue extends WorkspaceApi {}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectSource = useCallback((source: EmbeddingSource) => {
    dispatch({ type: "select-source", source });
  }, []);

  const setArea = useCallback((area: BoundingBox) => {
    dispatch({ type: "set-area", area });
  }, []);

  const startDrawing = useCallback(() => dispatch({ type: "start-drawing" }), []);
  const stopDrawing = useCallback(() => dispatch({ type: "stop-drawing" }), []);

  const retrieveSample = useCallback(
    async (sampleSize: number) => {
      const { source, area } = state;
      if (!source || !area) return;
      dispatch({ type: "retrieve-start", requested: sampleSize });
      try {
        const result = await source.query({ bounds: area, sampleSize });
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
    },
    [state],
  );

  const setView = useCallback((view: ViewMode) => dispatch({ type: "set-view", view }), []);
  const selectPoint = useCallback((id: string | null) => dispatch({ type: "select-point", id }), []);
  const setHoveredPoint = useCallback((id: string | null) => dispatch({ type: "hover-point", id }), []);
  const setQueryPoint = useCallback(
    (id: string | null) => dispatch({ type: "set-query-point", id }),
    [],
  );
  const toggleInspector = useCallback(() => dispatch({ type: "toggle-inspector" }), []);
  const setClusters = useCallback(
    (clusters: ClusterLayer) => dispatch({ type: "set-clusters", clusters }),
    [],
  );
  const clearClusters = useCallback(() => dispatch({ type: "clear-clusters" }), []);
  const setColorBasis = useCallback(
    (basis: ColorBasis) => dispatch({ type: "set-color-basis", basis }),
    [],
  );

  const api: WorkspaceContextValue = useMemo(
    () => ({
      state,
      selectSource,
      setArea,
      startDrawing,
      stopDrawing,
      retrieveSample,
      setView,
      selectPoint,
      setHoveredPoint,
      setQueryPoint,
      toggleInspector,
      setClusters,
      clearClusters,
      setColorBasis,
    }),
    [
      state,
      selectSource,
      setArea,
      startDrawing,
      stopDrawing,
      retrieveSample,
      setView,
      selectPoint,
      setHoveredPoint,
      setQueryPoint,
      toggleInspector,
      setClusters,
      clearClusters,
      setColorBasis,
    ],
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  }
  return ctx;
}