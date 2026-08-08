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
        <div className="flex items-center gap-2">
          <Input
            className="flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <Button
            className="bg-green-600 hover:bg-green-500"
            onClick={handleSave}
          >
            Save
          </Button>

          <Button className="bg-zinc-700 hover:bg-zinc-600" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            className="flex-1 text-left"
            onClick={() => onSelect(list.id)}
          >
            {list.name}
          </button>

          <Button
            className="bg-zinc-700 hover:bg-zinc-600"
            onClick={handleStartEdit}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
