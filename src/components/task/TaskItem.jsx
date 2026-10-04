import { useState } from "react";
import { Check, Pencil, Save, Trash2, X } from "lucide-react";

import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Input from "../ui/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import useInlineEditing from "../../hooks/useInlineEditing";
import TaskChecklist from "./TaskChecklist";

const STICKY_COLORS = [
  "var(--sticky-blue)",
  "var(--sticky-pink)",
  "var(--sticky-orange)",
  "var(--sticky-green)",
  "var(--sticky-purple)",
];

const ROTATIONS = [
  "sticky-rotate-1",
  "sticky-rotate-2",
  "sticky-rotate-3",
  "sticky-rotate-0",
];

function getStableIndex(id, length) {
  if (!id) return 0;

  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }

  return Math.abs(hash) % length;
}

export default function TaskItem({
  task,
  taskActions,
  editingId,
  onStartEdit,
}) {
  const {
    toggleTask,
    editTask,
    deleteTask,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    toggleChecklistItem,
  } = taskActions;

  const {
    value: editValues,
    setValue: setEditValues,
    startEditing,
  } = useInlineEditing();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isEditing = editingId === task.id;
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];

  const colorIndex = getStableIndex(task.id, STICKY_COLORS.length);
  const rotationIndex = getStableIndex(task.id, ROTATIONS.length);

  const background = STICKY_COLORS[colorIndex];
  const rotation = ROTATIONS[rotationIndex];

  const completedChecklistCount = checklist.filter(
    (item) => item.completed,
  ).length;

  const checklistProgress =
    checklist.length > 0
      ? (completedChecklistCount / checklist.length) * 100
      : 0;

  function handleStartEdit() {
    startEditing({
      title: task.title ?? "",
      description: task.description ?? "",
    });

    onStartEdit(task.id);
  }

  function handleSave() {
    const title = editValues?.title?.trim() ?? "";
    const description = editValues?.description?.trim() ?? "";

    if (!title) return;

    editTask(task.id, {
      title,
      description,
    });

    onStartEdit(null);
  }

  function handleCancel() {
    onStartEdit(null);
  }

  function handleToggleChecklistItem(itemId) {
    toggleChecklistItem(task.id, itemId);
  }

  function handleAddChecklistItem(text) {
    addChecklistItem(task.id, text);
  }

  function handleDeleteChecklistItem(itemId) {
    deleteChecklistItem(task.id, itemId);
  }

  function handleEditChecklistItem(itemId, text) {
    updateChecklistItem(task.id, itemId, { text });
  }

  if (isEditing) {
    return (
      <Card
        variant="sticky"
        className={`flex min-h-56 flex-col p-3 sm:p-4 lg:min-h-65 ${rotation}`}
        style={{ background }}
      >
        <div className="space-y-3">
          <Input
            value={editValues?.title ?? ""}
            onChange={(event) =>
              setEditValues((previous) => ({
                ...previous,
                title: event.target.value,
              }))
            }
            placeholder="Title"
            className="h-10 text-sm font-semibold"
            autoFocus
          />

          <Input
            value={editValues?.description ?? ""}
            onChange={(event) =>
              setEditValues((previous) => ({
                ...previous,
                description: event.target.value,
              }))
            }
            placeholder="Description (optional)"
            className="h-9 text-sm"
          />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={handleSave}
              className="h-8 flex-1 gap-1.5 text-xs"
            >
              <Save size={12} aria-hidden="true" />
              Save
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="h-8 flex-1 gap-1.5 text-xs"
            >
              <X size={12} aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant="sticky"
      className={`group relative flex min-h-60 min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:min-h-80 ${rotation}`}
      style={{ background }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-1 left-1/2 h-3 w-14 -translate-x-1/2 -rotate-1 rounded-sm bg-white/70 shadow-sm backdrop-blur-sm"
      />

      <div className="flex items-start gap-2">
        <label className="relative mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => toggleTask(task.id)}
            aria-label={
              task.completed
                ? `Mark "${task.title}" as active`
                : `Mark "${task.title}" as completed`
            }
            className="peer sr-only"
          />

          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white/90 transition-[background-color,border-color,box-shadow] peer-focus-visible:ring-2 peer-focus-visible:ring-(--primary)/40 peer-checked:border-(--primary) peer-checked:bg-(--primary)"
            style={{
              borderColor: task.completed
                ? "var(--primary)"
                : "var(--border-strong)",
            }}
          >
            {task.completed && (
              <Check
                size={11}
                strokeWidth={3}
                className="text-white"
                aria-hidden="true"
              />
            )}
          </span>
        </label>

        <h3
          className="min-w-0 flex-1 wrap-break-word pr-1 text-[15px] font-bold leading-snug"
          style={{
            color: "var(--text)",
            opacity: task.completed ? 0.6 : 1,
            textDecoration: task.completed ? "line-through" : "none",
          }}
        >
          {task.title}
        </h3>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={handleStartEdit}
            aria-label="Edit task"
            title="Edit task"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-(--border) bg-(--bg-elevated) text-(--text) shadow-sm transition-[background-color,box-shadow,color] hover:bg-(--bg-muted) hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
          >
            <Pencil size={11} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            aria-label="Delete task"
            title="Delete task"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-(--border) bg-(--bg-elevated) text-(--danger) shadow-sm transition-[background-color,box-shadow,color] hover:bg-(--danger-soft) hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--primary)"
          >
            <Trash2 size={11} aria-hidden="true" />
          </button>
        </div>
      </div>

      {task.description && (
        <p
          className="mt-2 min-w-0 line-clamp-3 wrap-break-word text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {task.description}
        </p>
      )}

      {checklist.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(0, 0, 0, 0.12)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${checklistProgress}%`,
                background: "var(--primary)",
              }}
            />
          </div>

          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-faint)" }}
          >
            {completedChecklistCount}/{checklist.length}
          </span>
        </div>
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <TaskChecklist
          items={checklist}
          onAdd={handleAddChecklistItem}
          onToggle={handleToggleChecklistItem}
          onDelete={handleDeleteChecklistItem}
          onEdit={handleEditChecklistItem}
        />
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Delete task?"
        description={`Are you sure you want to delete "${task.title}"?`}
        confirmLabel="Delete"
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          deleteTask(task.id);
          setIsDeleteOpen(false);
        }}
      />
    </Card>
  );
}
