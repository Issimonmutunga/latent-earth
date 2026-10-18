import { useWorkspace } from "../../app/workspace.tsx";
import type { ViewMode } from "../../types/embedding.ts";
import InspectTab from "../InspectTab.tsx";
import EmbeddingView from "../views/EmbeddingView.tsx";
import SimilarityView from "../views/SimilarityView.tsx";
import AnalysisView from "../views/AnalysisView.tsx";

export const RESULT_TABS: Array<{ id: ViewMode; label: string; key: string }> = [
  { id: "inspect", label: "Inspect", key: "1" },
  { id: "embedding", label: "Embedding", key: "2" },
  { id: "similarity", label: "Similarity", key: "3" },
  { id: "analysis", label: "Analysis", key: "4" },
];

/** Right panel: everything computed from the loaded sample, one tab per view. */
export default function ResultsPanel() {
  const { state, setView } = useWorkspace();
  const hasSample = state.sample !== null;

  return (
    <div className="results">
      <div className="tabs" role="tablist" aria-label="Results">
        {RESULT_TABS.map((t) => {
          const disabled = t.id !== "inspect" && !hasSample;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={state.view === t.id}
              className={`tabs__item${state.view === t.id ? " is-active" : ""}`}
              disabled={disabled}
              title={disabled ? "Retrieve a sample first" : `${t.label} (${t.key})`}
              onClick={() => setView(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="results__body" role="tabpanel">
        {(state.view === "inspect" || !hasSample) && <InspectTab />}
        {hasSample && state.view === "embedding" && <EmbeddingView />}
        {hasSample && state.view === "similarity" && <SimilarityView />}
        {hasSample && state.view === "analysis" && <AnalysisView />}
      </div>
    </div>
  );
}
