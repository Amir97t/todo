export default function FilterBar({ filter, onChange }) {
  const options = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
  ];
  return (
    <div
      className="inline-flex gap-1 rounded-xl p-1"
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((option) => {
        const active = filter === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:px-4 sm:text-sm"
            style={
              active
                ? {
                    background: "var(--primary)",
                    color: "white",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
