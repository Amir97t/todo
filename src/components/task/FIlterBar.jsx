export default function FilterBar({ filter, onChange }) {
  const btn = (value, label) => (
    <button
      onClick={() => onChange(value)}
      className={`rounded-lg px-4 py-2 transition
            ${
              filter === value
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
    >
      {label}
    </button>
  );
  return (
    <div className="mb-6 flex gap-3">
      {btn("all", "All")}
      {btn("newest", "Newest")}
      {btn("oldest", "Oldest")}
    </div>
  );
}
