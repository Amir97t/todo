import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListPlus, Plus, Sparkles, Trash2, X } from "lucide-react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/Card";
import useDialogFocus from "../../hooks/useDialogFocus";

function AddTaskDialog({ open, onClose, onAddTask, pending = false }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checklist, setChecklist] = useState([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemText, setItemText] = useState("");

  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();

  // Focus in on the title, keep Tab inside, close on Escape and return focus
  // to the opener — the same contract ConfirmDialog uses.
  const { handleKeyDown } = useDialogFocus({
    open,
    dialogRef,
    initialFocusRef: titleRef,
    onEscape: handleClose,
    lockScroll: true,
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setChecklist([]);
    setItemText("");
    setIsAddingItem(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleAddItem() {
    const text = itemText.trim();

    if (!text) return;

    setChecklist((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
      },
    ]);

    setItemText("");
  }

  function handleItemKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleAddItem();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setItemText("");
      setIsAddingItem(false);
    }
  }

  function handleRemoveItem(id) {
    setChecklist((previous) => previous.filter((item) => item.id !== id));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    // Awaited so the pending state is visible on the submit button, and so a
    // rejected create does not discard what the user typed.
    const saved = await onAddTask(trimmedTitle, description.trim(), checklist);

    if (!saved) return;

    handleClose();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-start justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-4">
      <button
        type="button"
        aria-label="Close add task dialog"
        onClick={handleClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
      />

      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
        className="relative w-full max-w-130 overflow-hidden rounded-[20px] border bg-(--bg-elevated) shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.12)]"
        style={{
          borderColor: "var(--border)",
          animation: "islandIn 0.34s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div className="flex justify-center pt-2.5">
          <span
            aria-hidden="true"
            className="h-1 w-9 rounded-full bg-(--border-strong)"
          />
        </div>

        <CardHeader className="pb-3 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "var(--primary)",
                  color: "white",
                }}
              >
                <Sparkles size={14} />
              </span>

              <div>
                <CardTitle id={titleId} className="text-base">
                  New Task
                </CardTitle>

                <CardDescription className="text-xs">
                  Minimal — title required
                </CardDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close add task dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-(--bg-muted) text-(--text-muted) transition-colors hover:bg-(--bg-soft) hover:text-(--text)"
              style={{ borderColor: "var(--border)" }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <Input
            ref={titleRef}
            placeholder="Task title..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Task title"
            required
            className="h-11"
          />

          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="Task description"
            rows={2}
            className="min-h-18"
          />

          <div
            className="rounded-xl border bg-(--bg-soft) p-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-faint)" }}
              >
                <ListPlus size={12} aria-hidden="true" />
                Checklist
                {checklist.length > 0 ? ` · ${checklist.length}` : ""}
              </span>

              {!isAddingItem && (
                <button
                  type="button"
                  onClick={() => setIsAddingItem(true)}
                  className="inline-flex items-center gap-1 rounded-lg border bg-(--bg-elevated) px-2 py-1 text-xs font-medium text-(--text-muted) transition-colors hover:bg-(--bg-soft) hover:text-(--text)"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Plus size={11} aria-hidden="true" />
                  Add
                </button>
              )}
            </div>

            {isAddingItem && (
              <div className="mb-2 flex gap-1.5">
                <Input
                  autoFocus
                  placeholder="Item..."
                  value={itemText}
                  onChange={(event) => setItemText(event.target.value)}
                  onKeyDown={handleItemKeyDown}
                  aria-label="New checklist item"
                  className="h-8 flex-1 text-sm"
                />

                <Button
                  type="button"
                  onClick={handleAddItem}
                  aria-label="Add checklist item"
                  className="h-8 px-3 text-xs"
                >
                  <Check size={12} aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setItemText("");
                    setIsAddingItem(false);
                  }}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            {checklist.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
                {checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-(--bg-elevated) px-2.5 py-1.5 text-sm"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="min-w-0 flex-1 wrap-break-word text-(--text)">
                      {item.text}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remove "${item.text}"`}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : !isAddingItem ? (
              <p
                className="rounded-lg border border-dashed bg-(--bg-elevated) px-3 py-2 text-center text-xs"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-faint)",
                }}
              >
                No items yet
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter
          className="gap-2 border-t pt-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={!title.trim() || pending}
            aria-busy={pending}
            className="flex-1 gap-1.5 disabled:opacity-40"
          >
            <Plus size={14} aria-hidden="true" />
            {pending ? "Adding…" : "Add Task"}
          </Button>
        </CardFooter>
      </form>
    </div>,
    document.body,
  );
}

export default function AddTaskCard({
  onAddTask,
  open: controlledOpen,
  onOpenChange,
  showTrigger,
  pending = false,
}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const shouldShowTrigger = showTrigger ?? !isControlled;

  function setOpen(nextOpen) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  return (
    <>
      {shouldShowTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98]"
          style={{
            background: "var(--primary)",
            color: "white",
          }}
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          New Task
        </button>
      )}

      <AddTaskDialog
        open={open}
        onClose={() => setOpen(false)}
        onAddTask={onAddTask}
        pending={pending}
      />
    </>
  );
}
