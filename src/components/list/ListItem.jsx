import { useState } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function ListItem({
  list,
  selected,
  onSelect,
  editingId,
  onStartEdit,
  onRename,
  onCancel,
  onDelete,
}) {
  // Local state is only for the input value.
  // The actual list name lives in App state.
  const [name, setName] = useState(list.name);
  const isEditing = editingId === list.id;

  function handleStartEdit() {
    // Initialize the local input when editing starts.
    // This avoids synchronously updating state inside an Effect.
    setName(list.name);
    onStartEdit(list.id);
  }

  function handleSave() {
    const trimmed = name.trim();

    if (!trimmed) return;

    onRename(list.id, trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleSave();
    }

    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div
      className={`mb-2 rounded-lg border p-2 transition ${
        selected ? "border-blue-500 bg-zinc-800" : "border-transparent"
      }`}
    >
      {isEditing ? (
        // The input gets the full available width while actions move below it.
        // This keeps editing usable inside the narrow sidebar.
        <div className="space-y-2">
          <Input
            className="w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-500"
              onClick={handleSave}
            >
              Save
            </Button>

            <Button
              className="flex-1 bg-zinc-700 hover:bg-zinc-600"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => onSelect(list.id)}
          >
            {list.name}
          </button>

          <div className="flex shrink-0 gap-2">
            <Button
              className="bg-zinc-700 hover:bg-zinc-600"
              onClick={handleStartEdit}
            >
              Edit
            </Button>

            {list.id !== "inbox" && (
              <Button
                className="bg-red-700 hover:bg-red-600"
                onClick={() => onDelete(list)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
