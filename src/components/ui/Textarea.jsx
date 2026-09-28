import { cn } from "../../lib/utils";

export default function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-xl border p-3.5 text-sm outline-none transition placeholder:text-(--text-faint) focus:ring-2 focus:ring-(--primary)/20",
        className,
      )}
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      {...props}
    />
  );
}
