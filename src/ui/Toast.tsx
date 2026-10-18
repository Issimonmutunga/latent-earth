import { useEffect, useState } from "react";
import { useWorkspace } from "../app/workspace.tsx";

const TOAST_MS = 2600;

/** Transient confirmation, bottom-center. */
export default function Toast() {
  const { state } = useWorkspace();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state.toast) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  if (!visible || !state.toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {state.toast.text}
    </div>
  );
}
