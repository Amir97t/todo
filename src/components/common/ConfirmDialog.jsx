import { useRef } from "react";
import Button from "../ui/Button";
import { AlertTriangle } from "lucide-react";
import useDialogFocus from "../../hooks/useDialogFocus";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  secondaryLabel,
  onConfirm,
  onSecondaryConfirm,
  onCancel,
  pending = false,
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);

  // Registered before the early return: hooks must run unconditionally.
  const { handleKeyDown } = useDialogFocus({
    open,
    dialogRef,
    initialFocusRef: confirmRef,
    onEscape: onCancel,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className="absolute inset-0"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <h2
          id="confirm-dialog-title"
          className="text-base font-bold"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {secondaryLabel && (
            <Button
              type="button"
              variant="danger"
              className="bg-red-800! hover:bg-red-700!"
              onClick={onSecondaryConfirm}
              disabled={pending}
              aria-busy={pending}
            >
              {secondaryLabel}
            </Button>
          )}
          <Button
            ref={confirmRef}
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
