import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import SearchBar from "../task/SearchBar";

export default function NotebookSearch({ value = "", onChange }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef(null);

  const isSearchOpen = searchOpen || Boolean(value);

  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const handleToggle = () => {
    if (isSearchOpen) {
      setSearchOpen(false);

      if (value) {
        onChange("");
      }

      return;
    }

    setSearchOpen(true);
  };

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={isSearchOpen ? "Close search" : "Open search"}
        title={isSearchOpen ? "Close search" : "Search"}
        aria-expanded={isSearchOpen}
        aria-controls="notebook-search-panel"
        onClick={handleToggle}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition hover:shadow active:scale-[0.98]"
        style={{
          background: isSearchOpen ? "var(--primary)" : "var(--bg-elevated)",
          borderColor: isSearchOpen ? "var(--primary)" : "var(--border)",
          color: isSearchOpen ? "white" : "var(--text-muted)",
        }}
      >
        {isSearchOpen ? (
          <X size={16} aria-hidden="true" />
        ) : (
          <Search size={16} aria-hidden="true" />
        )}
      </button>

      <div
        id="notebook-search-panel"
        aria-hidden={!isSearchOpen}
        className={[
          "origin-top rounded-xl border p-1.5 shadow-md backdrop-blur-md lg:p-[3px]",
          "transition-[width,margin,opacity,transform,translate,scale] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Below lg the panel floats under the navbar instead of growing it.
          "max-lg:absolute max-lg:inset-x-0 max-lg:top-full max-lg:z-40 max-lg:mt-2",
          isSearchOpen
            ? "opacity-100 translate-y-0 scale-100 lg:ml-2 lg:w-70"
            : [
                "opacity-0 -translate-y-1.5 scale-[0.97] pointer-events-none",
                "lg:ml-0 lg:w-0 lg:overflow-hidden",
              ].join(" "),
        ].join(" ")}
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border)",
        }}
      >
        <SearchBar
          ref={inputRef}
          value={value}
          onChange={onChange}
          tabIndex={isSearchOpen ? 0 : -1}
          className="w-full"
        />
      </div>
    </div>
  );
}
