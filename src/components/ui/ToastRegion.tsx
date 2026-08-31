"use client";

import { Icon } from "@/components/ui/Icon";
import { useWorkspace } from "@/providers/workspace-provider";

/** Confirmations and blocked-action notices. Every entry clears itself. */
export function ToastRegion() {
  const { toasts } = useWorkspace();

  return (
    <div id="toast-region" aria-live="polite">
      {toasts.map(toast => (
        <div className="toast" key={toast.id} role="status">
          <Icon name={toast.tone === "blocked" ? "incident" : "check"} />
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.detail}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
