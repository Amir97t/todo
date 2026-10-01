import { Moon, Sun } from "lucide-react";
import useTheme from "../../context/useTheme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-[background-color,border-color,filter] duration-300 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary) ${className}`}
      style={{
        background: "var(--bg-muted)",
        borderColor: "var(--border)",
      }}
    >
      {/* Odometer: a fixed-height window holding both icons stacked vertically. */}
      <span aria-hidden="true" className="absolute inset-0 block overflow-hidden">
        <span
          className="block transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{
            transform: isDark ? "translateY(-36px)" : "translateY(0px)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center"
            style={{ color: "var(--primary)" }}
          >
            <Sun size={16} strokeWidth={2.2} />
          </span>

          <span
            className="flex h-9 w-9 items-center justify-center"
            style={{ color: "var(--accent)" }}
          >
            <Moon size={15} strokeWidth={2.2} />
          </span>
        </span>
      </span>
    </button>
  );
}
