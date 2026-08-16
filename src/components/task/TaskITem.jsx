import { useState } from "react";
import Button from "../ui/Button";
import { Card } from "../ui/Card";
import Input from "../ui/Input";
import ConfirmDialog from "../common/ConfirmDialog";

export default function TaskItem({
  task,
  taskActions,
  editingId,
  onStartEdit,
}) {
  const { toggleTask, editTask } = taskActions;

  const isCurrentEditingTask = editingId === task.id;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function handleStartEdit() {
    // Initialize the local form state when editing starts.
    // This avoids using an Effect just to mirror task props into state.
    setTitle(task.title);
    setDescription(task.description);

    onStartEdit(task.id);
  }

  function handleSave() {
    if (!title.trim()) return;

    editTask(task.id, {
      title: title.trim(),
      description: description.trim(),
    });

    onStartEdit(null);
  }

  function handleCancel() {
    setTitle(task.title);
    setDescription(task.description);

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
            <>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-none bg-transparent p-0 text-lg font-semibold shadow-none focus:ring-0"
              />

              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 border-none bg-transparent p-0 text-sm text-zinc-400 shadow-none focus:ring-0"
              />
            </>
          ) : (
            <>
              <h3 className="font-semibold">{task.title}</h3>

              <p className="text-sm text-zinc-400">{task.description}</p>
            </>
          )}
        </div>
      </div>

      <div className="ml-4 flex gap-2">
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
            {/* <Button
              className="bg-red-600 hover:bg-red-500"
              onClick={() => deleteTask(task.id)}
            >
              Delete
            </Button> */}

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
          // The dialog only confirms the action.
          // TaskItem delegates the actual data mutation to App.
          taskActions.deleteTask(task.id);
          setIsDeleteOpen(false);
        }}
      />
    </Card>
  );
}
