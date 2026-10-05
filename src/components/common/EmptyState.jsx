import { FileText } from "lucide-react";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FileText,
  showActionLabel = false,
}) {
  const hasAction = Boolean(actionLabel && onAction);
  // Recovery controls must advertise themselves in text; optional shortcuts
  // keep the compact icon-only treatment they already ship with.
  const withLabel = hasAction && showActionLabel;

  const interactionClass = hasAction
    ? "hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
    : "cursor-default";

  const boxClass = [
    "mx-auto mb-4 flex items-center justify-center rounded-2xl border transition",
    withLabel ? "h-11 w-fit gap-2 px-5" : "h-14 w-14",
    interactionClass,
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
          <Icon
            size={withLabel ? 18 : 24}
            strokeWidth={withLabel ? 2.2 : 2.4}
            aria-hidden="true"
          />
          {withLabel ? <span className="text-sm font-semibold">{actionLabel}</span> : null}
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
