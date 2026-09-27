import { useState, useRef, useEffect } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { getSuggestedListIcon, LIST_ICON_OPTIONS } from "../../lib/listIcons";
import ListIcon from "../common/ListIcon";

export default function NewListForm({ onSave }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [iconOverride, setIconOverride] = useState(null);

  const inputRef = useRef(null);

  const suggestedIcon = getSuggestedListIcon(name);
  const activeIcon = iconOverride ?? suggestedIcon;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  function handleSave() {
    const value = name.trim();

    if (!value) return;

    const saved = onSave(value, activeIcon);

    if (!saved) return;

    setName("");
    setIconOverride(null);
    setIsOpen(false);
  }

  function handleCancel() {
    setName("");
    setIconOverride(null);
    setIsOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }

    if (event.key === "Escape") {
      handleCancel();
    }
  }

  function handleNameChange(event) {
    setName(event.target.value);

    if (iconOverride) {
      setIconOverride(null);
    }
  }

  if (!isOpen) {
    return (
      <Button
        type="button"
        className="w-full justify-start"
        onClick={() => setIsOpen(true)}
      >
        + New List
      </Button>
    );
  }

  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--primary-soft)",
            color: "var(--primary)",
          }}
        >
          <ListIcon icon={activeIcon} size={17} />
        </span>

        <Input
          ref={inputRef}
          value={name}
          placeholder="List name..."
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-faint)" }}
          >
            Choose icon
          </span>

          {iconOverride ? (
            <button
              type="button"
              onClick={() => setIconOverride(null)}
              className="text-[11px] font-medium transition hover:opacity-80"
              style={{ color: "var(--primary)" }}
            >
              Use suggestion
            </button>
          ) : (
            <span
              className="text-[11px]"
              style={{ color: "var(--text-faint)" }}
            >
              Suggested
            </span>
          )}
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {LIST_ICON_OPTIONS.map((option) => {
            const selected = activeIcon === option.value;

            return (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                aria-pressed={selected}
                onClick={() => setIconOverride(option.value)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border transition ${
                  selected
                    ? "shadow-sm"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={{
                  borderColor: selected ? "var(--primary)" : "var(--border)",
                  background: selected ? "var(--primary-soft)" : "transparent",
                  color: selected ? "var(--primary)" : "var(--text-muted)",
                }}
              >
                <ListIcon icon={option.value} size={15} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={handleSave}>
          Save
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
