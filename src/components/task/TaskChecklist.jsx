import { useState } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function TaskChecklist({
  items,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  function handleAdd() {
    const text = newText.trim();

    if (!text) return;

    onAdd(text);

    setNewText("");
    setIsAdding(false);
  }

  function handleStartEdit(item) {
    // Editing state belongs to the checklist item UI.
    // TaskItem only owns the task-level data.
    setEditingId(item.id);
    setEditText(item.text);
  }

  function handleSaveEdit() {
    const text = editText.trim();

    if (!text) return;

    onEdit(editingId, text);

    setEditingId(null);
    setEditText("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    }

    if (e.key === "Escape") {
      handleCancelEdit();
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => onToggle(item.id)}
            />

            {editingId === item.id ? (
              <>
                <Input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-w-0 flex-1"
                />

                <Button type="button" onClick={handleSaveEdit}>
                  Save
                </Button>

                <Button
                  type="button"
                  className="bg-zinc-700 hover:bg-zinc-600"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    item.completed
                      ? "text-zinc-500 line-through"
                      : "text-zinc-300"
                  }`}
                >
                  {item.text}
                </span>

                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                  onClick={() => handleStartEdit(item)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="space-y-2">
          <Input
            autoFocus
            value={newText}
            placeholder="Checklist item..."
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }

              if (e.key === "Escape") {
                setNewText("");
                setIsAdding(false);
              }
            }}
          />

          <div className="flex gap-2">
            <Button type="button" onClick={handleAdd}>
              Add Item
            </Button>

            <Button
              type="button"
              className="bg-zinc-700 hover:bg-zinc-600"
              onClick={() => {
                setNewText("");
                setIsAdding(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          className="bg-zinc-800 hover:bg-zinc-700"
          onClick={() => setIsAdding(true)}
        >
          + Add Item
        </Button>
      )}
    </div>
  );
}
