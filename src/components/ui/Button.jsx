import { cn } from "../../lib/utils";

export default function Button({
  children,
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-all",
        "hover:bg-blue-500",
        "active:scale-95",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
