import { cn } from "../../lib/utils";

export default function Button({
  children,
  className = "",
  type = "button",
  variant,
  ...props
}) {
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";

  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold",
        "transition-[background-color,box-shadow,transform,color]",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary) focus-visible:ring-offset-2",
        isGhost
          ? [
              "border border-(--border)",
              "bg-(--bg-muted) text-(--text-muted)",
              "shadow-none",
              "hover:bg-(--bg-elevated) hover:text-(--text)",
            ]
          : isDanger
            ? [
                "bg-red-600 text-white",
                "shadow-sm hover:bg-red-500 hover:shadow-md",
              ]
            : ["bg-(--primary) text-white", "shadow-sm hover:shadow-md"],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
