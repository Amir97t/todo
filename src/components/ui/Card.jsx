import { cn } from "../../lib/utils";

export function Card({ children, className = "", variant, ...props }) {
  const isSticky = variant === "sticky";

  return (
    <div
      className={cn(
        isSticky
          ? "sticky-note rounded-xl border border-(--border) shadow-(--sticky-shadow)"
          : "rounded-2xl border border-(--border) bg-(--bg-elevated) shadow-(--card-shadow) backdrop-blur-[2px] transition-shadow duration-200 hover:shadow-(--card-shadow-hover)",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={cn("space-y-1.5 p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }) {
  return (
    <h2
      className={cn(
        "text-[17px] font-semibold tracking-tight text-(--text) sm:text-xl",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardDescription({ children, className = "", ...props }) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-(--text-muted)", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={cn("px-5 sm:px-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }) {
  return (
    <div className={cn("flex justify-end p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}
