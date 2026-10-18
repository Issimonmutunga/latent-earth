import { useEffect, useRef } from "react";

interface StepPopoverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}

/** Lightweight floating panel attached to a control-bar step. */
export default function StepPopover({ open, onClose, title, wide, children }: StepPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Clicks on the control bar toggle steps themselves; don't double-close.
      if (target.closest?.(".control-bar")) return;
      if (ref.current && !ref.current.contains(target)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Close only the popover, not the view underneath it.
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`step-popover${wide ? " step-popover--wide" : ""}`} role="dialog" aria-label={title} ref={ref}>
      <div className="step-popover__header">
        <span>{title}</span>
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
