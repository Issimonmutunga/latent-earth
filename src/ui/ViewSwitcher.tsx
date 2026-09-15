import type { ViewMode } from "../types/embedding.ts";

const MODES: Array<{ mode: ViewMode; label: string; key: string }> = [
  { mode: "map", label: "Map", key: "1" },
  { mode: "embedding", label: "Embedding", key: "2" },
  { mode: "similarity", label: "Similarity", key: "3" },
  { mode: "analysis", label: "Analysis", key: "4" },
];

interface ViewSwitcherProps {
  active: ViewMode;
  disabled: boolean;
  onChange: (mode: ViewMode) => void;
}

/** Segmented control for switching between the four synchronized views. */
export default function ViewSwitcher({ active, disabled, onChange }: ViewSwitcherProps) {
  return (
    <div
      className={`view-switcher${disabled ? " is-disabled" : ""}`}
      role="toolbar"
      aria-label="View"
      title={disabled ? "Retrieve a sample first." : undefined}
    >
      {MODES.map(({ mode, label, key }) => (
        <button
          key={mode}
          type="button"
          className={`view-switcher__item${active === mode ? " is-active" : ""}`}
          aria-pressed={active === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          title={disabled ? "Retrieve a sample first." : `View ${label} (${key})`}
        >
          <span className="view-switcher__key">{key}</span>
          <span className="view-switcher__label">{label}</span>
        </button>
      ))}
    </div>
  );
}