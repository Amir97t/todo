import { cn } from "../../lib/utils";

export default function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none transition",
        "placeholder:text-zinc-500",
        "focus:border-blue-500",
        className,
      )}
      {...props}
    />
  );
}
