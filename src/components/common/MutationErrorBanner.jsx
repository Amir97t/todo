import { X } from "lucide-react";

/**
 * Single dismissible banner for mutation failures. Shared across every page
 * so there is exactly one place a failed action becomes visible.
 *
 * `role="alert"` makes screen readers announce it as it appears, and the
 * dismiss control is a real button so keyboard users can reach and operate it.
 */
export default function MutationErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3"
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
  );
}
