import { useEffect, useRef } from "react";

interface StepPopoverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Lightweight floating panel attached to a control-bar step. */
export default function StepPopover({ open, onClose, title, children }: StepPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="step-popover" role="dialog" aria-label={title} ref={ref}>
      <div className="step-popover__header">{title}</div>
      {children}
    </div>
  );
}