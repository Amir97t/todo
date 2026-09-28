import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import Input from "../ui/Input";

const SearchBar = forwardRef(function SearchBar(
  {
    value = "",
    onChange,
    className = "",
    placeholder = "Search tasks...",
    "aria-label": ariaLabel = "Search tasks",
    ...inputProps
  },
  ref,
) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />

      <Input
        ref={ref}
        {...inputProps}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 rounded-lg pl-8 pr-8 text-sm"
      />

      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X
            size={10}
            aria-hidden="true"
            style={{ color: "var(--text-faint)" }}
          />
        </button>
      )}
    </div>
  );
});

export default SearchBar;
