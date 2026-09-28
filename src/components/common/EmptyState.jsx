import { FileText } from "lucide-react";

export default function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-10 text-center sm:py-14"
      style={{ background: "color-mix(in srgb, var(--bg-elevated) 80%, transparent)", borderColor: "var(--border)" }}
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{ background: "var(--bg-muted)", borderColor: "var(--border)", color: "var(--text-faint)" }}
      >
        <FileText size={18} />
      </div>
      <h2 className="text-base font-bold sm:text-lg" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "var(--primary)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
