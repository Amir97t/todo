export default function EmptyState({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center">
      <h2 className="mb-2 text-xl font-semibold text-white">{title}</h2>
      <p className="text-zinc-400">{description}</p>
    </div>
  );
}
