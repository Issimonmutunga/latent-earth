interface ControlStepButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  emphasized?: boolean;
  onClick: () => void;
}

/** One step in the floating control bar. */
export default function ControlStepButton({
  icon,
  label,
  active,
  disabled,
  emphasized,
  onClick,
}: ControlStepButtonProps) {
  const classes = [
    "control-step",
    active ? "is-active" : "",
    emphasized ? "is-emphasized" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      <span className="control-step__icon" aria-hidden>
        {icon}
      </span>
      <span className="control-step__label">{label}</span>
      <span className="control-step__chevron" aria-hidden>
        ▾
      </span>
    </button>
  );
}