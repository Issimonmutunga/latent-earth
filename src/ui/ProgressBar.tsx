interface ProgressBarProps {
  /** 0..1 when determinate; omit for indeterminate. */
  progress?: number | null;
  label?: string;
}

/** Thin, inline progress indication. Never a blocking spinner. */
export default function ProgressBar({ progress = null, label }: ProgressBarProps) {
  const indeterminate = progress === null;
  return (
    <div className="progress" role="status">
      <div className="progress__track">
        {indeterminate ? (
          <div className="progress__fill is-indeterminate" />
        ) : (
          <div
            className="progress__fill"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        )}
      </div>
      {label ? <div className="progress__label">{label}</div> : null}
    </div>
  );
}