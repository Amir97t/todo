import { useState } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";
import useInlineEditing from "../../hooks/useInlineEditing";
import { Pencil, Trash2 } from "lucide-react";
import { getSuggestedListIcon, LIST_ICON_OPTIONS } from "../../lib/listIcons";
import { INBOX_LIST_ID } from "../../lib/constants";
import ListIcon from "../common/ListIcon";

export default function ListItem({
  list,
  selected,
  onSelect,
  editingId,
  onStartEdit,
  onRename,
  onCancel,
  onDelete,
  collapsed,
}) {
  const { value: name, setValue: setName, startEditing } = useInlineEditing();

  const [editIcon, setEditIcon] = useState(null);

  const isCurrentEditingList = editingId === list.id;
  const isInbox = list.id === INBOX_LIST_ID;

  const listIcon =
    list.icon ?? (isInbox ? "inbox" : getSuggestedListIcon(list.name));

  const activeEditIcon =
    editIcon ??
    list.icon ??
    (isInbox ? "inbox" : getSuggestedListIcon(name || list.name));

  const suggestedEditIcon = getSuggestedListIcon(name || list.name);

  function handleStartEdit() {
    startEditing(list.name);
    setEditIcon(listIcon);
    onStartEdit(list.id);
  }

  function handleSave() {
    const trimmed = name.trim();

    if (!trimmed) return;

    onRename(list.id, trimmed, activeEditIcon);
  }

  function handleCancel() {
    setEditIcon(null);
    onCancel();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      handleSave();
    }

    if (event.key === "Escape") {
      handleCancel();
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        title={list.name}
        aria-label={list.name}
        onClick={() => onSelect(list.id)}
        className={`flex h-10 w-full items-center justify-center rounded-xl transition ${
          selected ? "text-white shadow-sm" : "hover:opacity-90"
        }`}
        style={
          selected
            ? { background: "var(--primary)" }
            : {
                background: "var(--bg-muted)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }
        }
      >
        <ListIcon icon={listIcon} size={17} strokeWidth={1.9} />
      </button>
    );
  }

  if (isCurrentEditingList) {
    return (
      <div
        className="rounded-xl border p-2.5"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--primary)",
          boxShadow:
            "0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent)",
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
            <ListIcon icon={activeEditIcon} size={17} strokeWidth={1.9} />
          </span>

          <Input
            value={name ?? ""}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-9 min-w-0 flex-1"
          />
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-faint)" }}
            >
              Choose icon
            </span>

            {activeEditIcon !== suggestedEditIcon && (
              <button
                type="button"
                onClick={() => setEditIcon(suggestedEditIcon)}
                className="text-[11px] font-medium transition hover:opacity-80"
                style={{ color: "var(--primary)" }}
              >
                Use suggestion
              </button>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {LIST_ICON_OPTIONS.map((option) => {
              const selectedIcon = activeEditIcon === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={selectedIcon}
                  onClick={() => setEditIcon(option.value)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border transition hover:shadow-sm"
                  style={{
                    borderColor: selectedIcon
                      ? "var(--primary)"
                      : "var(--border)",
                    background: selectedIcon
                      ? "var(--primary-soft)"
                      : "transparent",
                    color: selectedIcon
                      ? "var(--primary)"
                      : "var(--text-muted)",
                  }}
                >
                  <ListIcon icon={option.value} size={15} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button className="h-8 flex-1 text-xs" onClick={handleSave}>
            Save
          </Button>

          <Button
            variant="ghost"
            className="h-8 flex-1 text-xs"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition ${
        selected ? "shadow-sm" : "hover:shadow-sm"
      }`}
      style={
        selected
          ? {
              background: "var(--primary-soft)",
              borderColor: "var(--primary)",
              color: "var(--text)",
            }
          : {
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
            }
      }
    >
      {selected && (
        <span
          className="absolute inset-y-2 left-0 w-[3px] rounded-full"
          style={{ background: "var(--primary)" }}
        />
      )}

      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: selected ? "var(--primary)" : "var(--bg-muted)",
          color: selected ? "white" : "var(--text-muted)",
          border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
        }}
      >
        <ListIcon icon={listIcon} size={13} strokeWidth={1.9} />
      </span>

      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left"
        onClick={() => onSelect(list.id)}
      >
        {list.name}
      </button>

      {!isInbox && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Rename ${list.name}`}
            onClick={handleStartEdit}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border opacity-60 transition hover:opacity-100 group-hover:opacity-100"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
            }}
          >
            <Pencil size={11} />
          </button>

          <button
            type="button"
            aria-label={`Delete ${list.name}`}
            onClick={() => onDelete(list)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border opacity-60 transition hover:opacity-100 group-hover:opacity-100 hover:!border-red-200 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/40"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
            }}
          >
            <Trash2 size={11} />
          </button>
        </span>
      )}
    </div>
  );
}
