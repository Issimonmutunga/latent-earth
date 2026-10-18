import { useState } from "react";
import { useWorkspace } from "../app/workspace.tsx";
import { useTargetModel } from "../app/targetModel.tsx";
import {
  buildTargetRows,
  guessTargetColumn,
  parseTargetFile,
  type ParsedTable,
} from "../analysis/target.ts";

const MAX_ERRORS_SHOWN = 4;

/** Attach real ground truth: upload a file, or label points by hand. */
export default function TargetPanel() {
  const { state, setTarget, clearTarget, setColorBasis, setView } = useWorkspace();
  const model = useTargetModel();
  const { target, sample } = state;
  const [file, setFile] = useState<{ name: string; table: ParsedTable } | null>(null);
  const [column, setColumn] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const table = parseTargetFile(text, f.name);
    setFile({ name: f.name, table });
    setColumn(guessTargetColumn(table));
  }

  const preview = file && column ? buildTargetRows(file.table, column) : null;

  function attach() {
    if (!file || !column || !preview || preview.rows.length === 0) return;
    setTarget({
      id: `${file.name}:${column}`,
      name: column,
      kind: preview.kind,
      origin: "upload",
      rows: preview.rows,
    });
    setFile(null);
  }

  return (
    <div className="target-panel">
      <p className="popover-copy">
        Got ground truth? Attach it to test whether the embedding predicts what you care about —
        land cover, crop type, biomass, anything.
      </p>

      {target && (
        <div className="target-current">
          <div className="target-current__head">
            <strong>{target.name}</strong>
            <span className="badge">{target.kind === "label" ? "classes" : "numeric"}</span>
            <span className="badge">{target.origin === "manual" ? "hand-labeled" : "uploaded"}</span>
          </div>
          <p className="popover-copy popover-copy--muted">
            {target.rows.length.toLocaleString()} rows
            {model && sample
              ? ` · ${model.match.byPoint.size.toLocaleString()} matched to sampled points` +
                (model.match.unmatchedRows ? ` · ${model.match.unmatchedRows.toLocaleString()} outside the sample` : "")
              : " · retrieve a sample to match them"}
            {model?.kind === "label" && model.classes.length ? ` · ${model.classes.length} classes` : ""}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="btn btn--small"
              disabled={!model?.predicted}
              onClick={() => setColorBasis("target")}
            >
              Color map by target
            </button>
            <button type="button" className="btn btn--small" disabled={!sample} onClick={() => setView("analysis")}>
              See analysis
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={clearTarget}>
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="block-title">Upload a file</div>
      <label className="file-drop">
        <input type="file" accept=".csv,.tsv,.txt,.json,.geojson" onChange={(e) => void onFile(e)} />
        <span>
          <strong>Choose CSV or GeoJSON</strong>
          <br />
          <span className="popover-copy--muted">CSV needs <code>lat</code>, <code>lon</code> and a value column</span>
        </span>
      </label>

      {file && (
        <div className="upload-review">
          <p className="popover-copy">
            <strong>{file.name}</strong>: {file.table.records.length.toLocaleString()} of{" "}
            {file.table.totalRows.toLocaleString()} rows usable.
          </p>
          {file.table.errors.length > 0 && (
            <ul className="error-list">
              {file.table.errors.slice(0, MAX_ERRORS_SHOWN).map((err) => (
                <li key={err}>{err}</li>
              ))}
              {file.table.errors.length > MAX_ERRORS_SHOWN && (
                <li>…and {file.table.errors.length - MAX_ERRORS_SHOWN} more.</li>
              )}
            </ul>
          )}
          {file.table.columns.length > 0 && (
            <label className="field">
              <span className="field__label">Column to use as target</span>
              <select className="select" value={column ?? ""} onChange={(e) => setColumn(e.target.value)}>
                {file.table.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          {preview && (
            <p className="popover-copy popover-copy--muted">
              Detected as {preview.kind === "label" ? "categories" : "numeric values"} ·{" "}
              {preview.rows.length.toLocaleString()} rows
              {preview.skipped ? ` (${preview.skipped} with an empty cell skipped)` : ""}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="btn btn--primary btn--small"
              disabled={!preview || preview.rows.length === 0}
              onClick={attach}
            >
              Attach target
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setFile(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="block-title">Or label by hand</div>
      <p className="popover-copy popover-copy--muted">
        Click a point on the map, type a label like “forest” or “urban” in the inspector, and repeat for
        a few points per class. The app predicts the rest from the embedding.
      </p>
    </div>
  );
}
