import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
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
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label={
          isSearchOpen ? "Close notebook search" : "Open notebook search"
        }
        aria-expanded={isSearchOpen}
        onClick={handleToggle}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-shadow hover:shadow active:scale-[0.98]"
        style={{
          background: isSearchOpen ? "var(--primary)" : "var(--bg-elevated)",
          borderColor: isSearchOpen ? "var(--primary)" : "var(--border)",
          color: isSearchOpen ? "white" : "var(--text-muted)",
        }}
      >
        {isSearchOpen ? (
          <X size={16} aria-hidden="true" />
        ) : (
          <BookOpen size={16} aria-hidden="true" />
        )}
      </button>

      <div
        aria-hidden={!isSearchOpen}
        className={`overflow-hidden ${
          isSearchOpen
            ? "ml-2 w-40 opacity-100 sm:w-55 md:w-70"
            : "ml-0 w-0 opacity-0"
        } transition-[width,margin,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
      >
        <div
          className="relative rounded-xl border p-0.5 shadow-md wood-texture"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="relative rounded-[10px] p-2 paper-texture">
            <SearchBar
              ref={inputRef}
              value={value}
              onChange={onChange}
              tabIndex={isSearchOpen ? 0 : -1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
