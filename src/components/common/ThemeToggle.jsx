import { Moon, Sun } from "lucide-react";
import useTheme from "../../context/useTheme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex h-9 w-16 items-center rounded-full border p-1 transition-colors duration-300 ${className}`}
      style={{
        background: "var(--bg-muted)",
        borderColor: "var(--border)",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full opacity-60 transition-opacity duration-300"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 70% 30%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%)"
            : "radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 60%)",
        }}
      />

      <span
        aria-hidden="true"
        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-transform duration-300 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
        style={{
          background: "var(--bg-elevated)",
          color: isDark ? "var(--accent)" : "var(--primary)",
        }}
      >
        {isDark ? (
          <Moon size={14} strokeWidth={2.2} />
        ) : (
          <Sun size={15} strokeWidth={2.2} />
        )}
      </span>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-2"
      >
        <Sun
          size={10}
          className={`transition-opacity duration-300 ${
            isDark ? "opacity-20" : "opacity-50"
          }`}
          style={{ color: "var(--primary)" }}
        />

        <Moon
          size={10}
          className={`transition-opacity duration-300 ${
            isDark ? "opacity-50" : "opacity-20"
          }`}
          style={{ color: "var(--accent)" }}
        />
      </span>
    </button>
  );
}
