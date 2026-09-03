export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center">
      <h2 className="mb-2 text-xl font-semibold text-white">{title}</h2>

      <p className="text-zinc-400">{description}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
