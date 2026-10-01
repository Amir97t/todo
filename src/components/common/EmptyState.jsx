import { FileText } from "lucide-react";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FileText,
}) {
  const hasAction = Boolean(actionLabel && onAction);

  const boxClass = [
    "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition",
    hasAction
      ? "hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
      : "cursor-default",
  ].join(" ");

  const boxStyle = hasAction
    ? { background: "var(--primary)", borderColor: "var(--primary)", color: "white" }
    : {
        background: "var(--bg-muted)",
        borderColor: "var(--border)",
        color: "var(--text-faint)",
      };

  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-10 text-center sm:py-14"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 80%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      {hasAction ? (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          title={actionLabel}
          className={boxClass}
          style={boxStyle}
        >
          <Icon size={24} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : (
        <div className={boxClass} style={boxStyle}>
          <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
        </div>
      )}

      <h2
        className="text-base font-bold sm:text-lg"
        style={{ color: "var(--text)" }}
      >
        {title}
      </h2>

      <p
        className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {description}
      </p>
    </div>
  );
}
