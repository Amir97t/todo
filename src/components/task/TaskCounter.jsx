export default function TaskCounter({ total, label = "Tasks" }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      <span
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
        style={{ background: "var(--primary)" }}
      >
        {total}
      </span>
      {label}
    </span>
  );
}
