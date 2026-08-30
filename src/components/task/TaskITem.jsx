import { useState } from "react";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Input from "../ui/Input";
import ConfirmDialog from "../common/ConfirmDialog";
import useInlineEditing from "../../hooks/useInlineEditing";

export default function TaskItem({
  task,
  taskActions,
  editingId,
  onStartEdit,
}) {
  const { toggleTask, editTask } = taskActions;

  const {
    value: editValues,
    setValue: setEditValues,
    startEditing,
  } = useInlineEditing();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isCurrentEditingTask = editingId === task.id;

  // Prevent old or malformed task data from breaking the task card.
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];

  function handleStartEdit() {
    // Take a snapshot of the current task when editing starts.
    // The parent still owns the actual task data.
    startEditing({
      title: task.title,
      description: task.description,
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
    const updatedChecklist = checklist.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
          }
        : item,
    );

    // Keep checklist as a separate field from the free-form description.
    editTask(task.id, {
      checklist: updatedChecklist,
    });
  }

  return (
    <Card className="flex items-center justify-between p-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task.id)}
        />

        <div className="min-w-0 flex-1">
          {isCurrentEditingTask ? (
            <div className="space-y-2">
              <Input
                value={editValues?.title ?? ""}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                className="border-none bg-transparent p-0 text-lg font-semibold shadow-none focus:ring-0"
                autoFocus
              />

              <Input
                value={editValues?.description ?? ""}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="border-none bg-transparent p-0 text-sm text-zinc-400 shadow-none focus:ring-0"
              />
            </div>
          ) : (
            <>
              <h3 className="font-semibold">{task.title}</h3>

              {task.description && (
                <p className="mt-1 text-sm text-zinc-400">{task.description}</p>
              )}

              {checklist.length > 0 && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {checklist.map((item) => (
                    <label key={item.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklistItem(item.id)}
                      />

                      <span
                        className={
                          item.completed
                            ? "text-zinc-500 line-through"
                            : "text-zinc-300"
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="ml-4 flex shrink-0 gap-2">
        {isCurrentEditingTask ? (
          <>
            <Button onClick={handleSave}>Save</Button>

            <Button
              className="bg-zinc-700 hover:bg-zinc-600"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              className="bg-red-700 hover:bg-red-600"
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete
            </Button>

            <Button onClick={handleStartEdit}>Edit</Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Delete task?"
        description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          // Confirmation handles the UI decision; App performs the mutation.
          taskActions.deleteTask(task.id);
          setIsDeleteOpen(false);
        }}
      />
    </Card>
  );
}
