import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Single dismissible banner for mutation failures. Shared across every page
 * so there is exactly one place a failed action becomes visible.
 *
 * It lives in a fixed notification layer on `document.body` instead of in the
 * page flow. The mobile drawer and its backdrop are fixed layers of their
 * own, so a banner that takes part in the normal flow is painted underneath
 * them and cannot be read while the drawer is open. Out of the flow it also
 * cannot push the page down when it appears, which would shift the sidebar
 * toggle out from under the reader.
 *
 * `role="alert"` makes screen readers announce it as it appears, and the
 * dismiss control is a real button so keyboard users can reach and operate it.
 */
export default function MutationErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl"
        style={{
          background: "var(--danger-soft, rgba(220, 38, 38, 0.12))",
          borderColor: "var(--danger, #dc2626)",
          color: "var(--text)",
        }}
      >
        <p className="min-w-0 flex-1 text-sm leading-relaxed">{message}</p>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          title="Dismiss error"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--danger)"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
