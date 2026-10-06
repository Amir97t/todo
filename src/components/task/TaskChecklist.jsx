import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";

import Input from "../ui/Input";

export default function TaskChecklist({
  items,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  pending = false,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [scrollState, setScrollState] = useState({
    canScroll: false,
    atBottom: false,
  });

  const listRef = useRef(null);

  const updateScrollState = useCallback(() => {
    const element = listRef.current;

    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 4;
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 4;

    setScrollState((previous) => {
      if (previous.canScroll === canScroll && previous.atBottom === atBottom) {
        return previous;
      }

      return { canScroll, atBottom };
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollState);

    return () => cancelAnimationFrame(frame);
  }, [items, updateScrollState]);

  useEffect(() => {
    const element = listRef.current;

    if (!element) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);

    return () => observer.disconnect();
  }, [updateScrollState]);

  async function handleAdd() {
    const text = newText.trim();

    if (!text) return;

    // Awaited so the confirm button shows its busy state, and a rejected add
    // does not throw away the text the user typed.
    const saved = await onAdd(text);

    if (!saved) return;

    setNewText("");
    setIsAdding(false);
  }

  function handleStartEdit(item) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  function handleSaveEdit() {
    const text = editText.trim();

    if (!text || !editingId) return;

    onEdit(editingId, text);
    setEditingId(null);
    setEditText("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleEditKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSaveEdit();
    }

    if (event.key === "Escape") {
      handleCancelEdit();
    }
  }

  function handleAddKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }

    if (event.key === "Escape") {
      setNewText("");
      setIsAdding(false);
    }
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "auto",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="relative min-h-32 flex-1">
        <div
          ref={listRef}
          onScroll={updateScrollState}
          className="no-scrollbar absolute inset-x-0 top-0 bottom-7 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
        >
          {items.map((item) => {
            const isEditing = editingId === item.id;

            return (
              <div key={item.id} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  aria-pressed={item.completed}
                  aria-label={
                    item.completed
                      ? `Mark "${item.text}" incomplete`
                      : `Mark "${item.text}" complete`
                  }
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border bg-(--bg-elevated) transition-[background-color,border-color,box-shadow] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-(--primary)/30 sm:h-4.5 sm:w-4.5"
                  style={{
                    borderColor: item.completed
                      ? "var(--primary)"
                      : "var(--border-strong)",
                    background: item.completed
                      ? "var(--primary)"
                      : "var(--bg-elevated)",
                    color: "white",
                  }}
                >
                  {item.completed && (
                    <Check size={10} strokeWidth={3} aria-hidden="true" />
                  )}
                </button>

                {isEditing ? (
                  <div className="flex min-w-0 flex-1 gap-1">
                    <Input
                      autoFocus
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      onKeyDown={handleEditKeyDown}
                      aria-label={`Edit "${item.text}"`}
                      className="h-7 min-w-0 flex-1 px-2 text-xs"
                    />

                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      aria-label="Save checklist item"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--primary) text-white transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-(--primary)/30"
                    >
                      <Check size={11} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      aria-label="Cancel editing"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-(--bg-elevated) text-(--text-muted) transition-colors hover:text-(--text)"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 gap-1">
                    <span className="min-w-0 flex-1 wrap-break-word text-[13px] leading-4.5">
                      <span
                        className={`checklist-text ${
                          item.completed ? "is-done" : ""
                        }`}
                        style={{
                          color: item.completed
                            ? "var(--text-faint)"
                            : "var(--text)",
                        }}
                      >
                        {item.text}
                      </span>

                      {item.completed && (
                        <span
                          aria-hidden="true"
                          className="ml-1 inline-flex align-middle"
                          style={{
                            animation: "pencilWiggle 0.35s ease",
                            color: "var(--text-faint)",
                          }}
                        >
                          <Pencil size={10} />
                        </span>
                      )}
                    </span>

                    <div className="flex shrink-0 gap-0.5 self-start">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        aria-label={`Edit "${item.text}"`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--text-faint) transition-colors hover:bg-(--bg-elevated) hover:text-(--text)"
                      >
                        <Pencil size={10} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Delete "${item.text}"`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--text-faint) transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={10} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scrollState.canScroll && !scrollState.atBottom && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-7 h-9 bg-gradient-to-t from-black/12 to-transparent"
            />

            <button
              type="button"
              onClick={scrollToBottom}
              aria-label="Scroll to see more checklist items"
              title="More checklist items below"
              className="absolute bottom-0 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border bg-(--bg-elevated) shadow-md backdrop-blur transition-[background-color,box-shadow] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-(--primary)/30"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {isAdding ? (
        <div className="flex gap-1.5 pt-1">
          <Input
            autoFocus
            value={newText}
            placeholder="New item..."
            onChange={(event) => setNewText(event.target.value)}
            onKeyDown={handleAddKeyDown}
            aria-label="New checklist item"
            className="h-7 min-w-0 flex-1 px-2 text-xs"
          />

          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            aria-busy={pending}
            aria-label="Add checklist item"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--primary) text-white transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-(--primary)/30 disabled:pointer-events-none disabled:opacity-50"
          >
            <Check size={11} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              setNewText("");
              setIsAdding(false);
            }}
            aria-label="Cancel adding checklist item"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-(--bg-elevated) text-(--text-muted) transition-colors hover:text-(--text)"
            style={{ borderColor: "var(--border)" }}
          >
            <X size={11} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          aria-label="Add checklist item"
          title="Add checklist item"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border bg-(--bg-elevated) text-(--text-muted) transition-colors hover:text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
          style={{ borderColor: "var(--border)" }}
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
