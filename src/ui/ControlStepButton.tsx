interface ControlStepButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  /** Position in the core sequence; shown as a badge until the step is done. */
  step?: number;
  done?: boolean;
  disabled?: boolean;
  emphasized?: boolean;
  /** De-emphasized add-on control (e.g. the optional target). */
  secondary?: boolean;
  onClick: () => void;
}

/** One step in the floating control bar. */
export default function ControlStepButton({
  icon,
  label,
  active,
  step,
  done,
  disabled,
  emphasized,
  secondary,
  onClick,
}: ControlStepButtonProps) {
  const classes = [
    "control-step",
    active ? "is-active" : "",
    done ? "is-done" : "",
    emphasized ? "is-emphasized" : "",
    secondary ? "is-secondary" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-expanded={active}>
      {step !== undefined ? (
        <span className="control-step__badge" aria-hidden>
          {done ? "✓" : step}
        </span>
      ) : (
        <span className="control-step__icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="control-step__label">{label}</span>
      <span className="control-step__chevron" aria-hidden>
        ▾
      </span>
    </button>
  );
}
