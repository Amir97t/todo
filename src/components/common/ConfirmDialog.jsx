import Button from "../ui/Button";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  // ConfirmDialog only manages the confirmation UI.
  // It doesn't know how data is deleted; the parent decides what onConfirm does.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">{title}</h2>

        <p className="mt-2 text-sm text-zinc-400">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button className="bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
            Cancel
          </Button>

          <Button className="bg-red-700 hover:bg-red-600" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
