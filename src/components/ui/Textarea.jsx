import { cn } from "../../lib/utils";

export default function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-white outline-none transition",
        "placeholder:text-zinc-500",
        "focus:border-blue-500",
        className,
      )}
      {...props}
    />
  );
}
