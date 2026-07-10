import { cn } from "../../lib/utils";

export function Card({ children, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={cn("space-y-2 p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h2 className={cn("text-xl font-semibold text-white", className)}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className }) {
  return (
    <p className={cn("text-sm text-zinc-400", className)}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }) {
  return (
    <div className={cn("px-6", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }) {
  return (
    <div className={cn("flex justify-end p-6", className)}>
      {children}
    </div>
  );
}