import { CheckCheck, LayoutList, ListTodo, Plus } from "lucide-react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "../common/ThemeToggle";
import NotebookSearch from "./NotebookSearch";

// Single place to rename the app.
const BRAND_NAME = "Tasknote";

const NAV_LINK_BASE =
  "inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm leading-none font-semibold transition-colors sm:px-4";

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
      className="sticky top-0 z-30 mb-4 flex w-full flex-nowrap items-center gap-1 rounded-2xl border py-2 pl-12 pr-2 shadow-sm backdrop-blur-md sm:mb-8 sm:gap-3 sm:py-2.5 sm:pl-14 sm:pr-3 lg:pl-3"
      style={{
        background: "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        {typeof onNewTask === "function" && (
          <button
            type="button"
            onClick={onNewTask}
            aria-label="New task"
            title="New task"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition hover:brightness-110 hover:shadow active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary) sm:inline-flex"
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-9 sm:w-9"
          style={{
            background: "var(--primary)",
            color: "white",
          }}
        >
          <ListTodo size={17} strokeWidth={2.3} />
        </span>

        <span
          className="min-w-0 truncate text-base font-bold tracking-tight sm:text-xl"
          style={{ color: "var(--text)" }}
        >
          {BRAND_NAME}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {typeof onSearchChange === "function" && (
          <NotebookSearch value={searchValue} onChange={onSearchChange} />
        )}

        <div
          className="flex shrink-0 items-center gap-1 rounded-xl p-1"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <NavLink
            to="/"
            end
            aria-label="Active tasks"
            className={linkClass}
            style={({ isActive }) =>
              isActive ? { background: "var(--primary)" } : undefined
            }
          >
            <LayoutList size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Active</span>
          </NavLink>

          <NavLink
            to="/completed"
            aria-label="Completed tasks"
            className={linkClass}
            style={({ isActive }) =>
              isActive ? { background: "var(--primary)" } : undefined
            }
          >
            <CheckCheck size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Completed</span>
          </NavLink>
        </div>

        <ThemeToggle />
      </div>
    </nav>
  );
}
