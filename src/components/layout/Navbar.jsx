import { Check, CheckCheck, LayoutList, Plus } from "lucide-react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "../common/ThemeToggle";
import NotebookSearch from "./NotebookSearch";

const NAV_LINK_BASE =
  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors sm:px-4";

export default function Navbar({
  searchValue = "",
  onSearchChange,
  onNewTask,
}) {
  const linkClass = ({ isActive }) =>
    `${NAV_LINK_BASE} ${
      isActive
        ? "text-white shadow-sm"
        : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
    }`;

  return (
    <nav
      className="mb-6 flex w-full flex-wrap justify-between gap-3 rounded-2xl border px-3 py-3 shadow-sm backdrop-blur-md sm:mb-8 sm:px-4"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-2.5">
        {typeof onNewTask === "function" && (
          <button
            type="button"
            onClick={onNewTask}
            aria-label="New task"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-shadow hover:shadow active:scale-[0.98]"
            style={{
              background: "var(--primary)",
              color: "white",
            }}
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}

        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-xl shadow-sm"
          style={{
            background: "var(--primary)",
            color: "white",
          }}
        >
          <Check size={17} strokeWidth={2.5} />
        </span>

        <span
          className="text-[17px] font-bold tracking-tight sm:text-xl"
          style={{ color: "var(--text)" }}
        >
          ToDo
        </span>

        <span
          className="hidden text-xs font-medium sm:inline"
          style={{ color: "var(--text-faint)" }}
        >
          Notebook
        </span>
      </div>

      <div className="flex max-w-full items-center gap-2">
        {typeof onSearchChange === "function" && (
          <NotebookSearch value={searchValue} onChange={onSearchChange} />
        )}

        <div
          className="flex items-center gap-1.5 rounded-xl p-1"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <NavLink
            to="/"
            end
            className={linkClass}
            style={({ isActive }) =>
              isActive ? { background: "var(--primary)" } : undefined
            }
          >
            <LayoutList size={14} aria-hidden="true" />
            <span>Active</span>
          </NavLink>

          <NavLink
            to="/completed"
            className={linkClass}
            style={({ isActive }) =>
              isActive ? { background: "var(--primary)" } : undefined
            }
          >
            <CheckCheck size={14} aria-hidden="true" />
            <span>Completed</span>
          </NavLink>
        </div>

        <ThemeToggle />
      </div>
    </nav>
  );
}
