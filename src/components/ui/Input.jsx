import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Input = forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border px-3.5 text-sm outline-hidden",
        "border-(--border) bg-(--bg-elevated) text-(--text)",
        "placeholder:text-(--text-faint)",
        "transition-[border-color,box-shadow]",
        "focus:border-(--primary) focus:ring-2 focus:ring-(--primary)/20",
        className,
      )}
      {...props}
    />
  );
});

export default Input;
