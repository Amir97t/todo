import Button from "../ui/Button";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  secondaryLabel,
  onConfirm,
  onSecondaryConfirm,
  onCancel,
}) {
  if (!open) return null;

  // ConfirmDialog only manages the confirmation UI.
  // It doesn't know how data is deleted; the parent decides what onConfirm does.

  return   (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">
          {title}
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            className="bg-zinc-700 hover:bg-zinc-600"
            onClick={onCancel}
          >
            Cancel
          </Button>

          {secondaryLabel && (
            <Button
              type="button"
              className="bg-red-800 hover:bg-red-700"
              onClick={onSecondaryConfirm}
            >
              {secondaryLabel}
            </Button>
          )}

          <Button
            type="button"
            className="bg-red-600 hover:bg-red-500"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
