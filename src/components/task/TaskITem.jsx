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

  function handleStartEdit() {
    // Start with a snapshot of the current task values.
    // Editing state stays local to the task UI.
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

  return (
    <Card className="flex items-center justify-between p-5">
      <div className="flex flex-1 gap-4">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleTask(task.id)}
        />

        <div className="flex-1">
          {isCurrentEditingTask ? (
            <div className="space-y-1">
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

              <p className="text-sm text-zinc-400">{task.description}</p>
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
          // The dialog confirms the action; App still owns the data mutation.
          taskActions.deleteTask(task.id);
          setIsDeleteOpen(false);
        }}
      />
    </Card>
  );
}
