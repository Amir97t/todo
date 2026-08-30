import { useState } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function TaskChecklist({
  items,
  onAdd,
  onToggle,
  onDelete,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState("");

  function handleAdd() {
    const trimmed = text.trim();

    if (!trimmed) return;

    onAdd(trimmed);

    setText("");
    setIsAdding(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }

    if (e.key === "Escape") {
      setText("");
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => onToggle(item.id)}
            />

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
              className="text-xs text-red-400 hover:text-red-300"
              onClick={() => onDelete(item.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="space-y-2">
          <Input
            autoFocus
            value={text}
            placeholder="Checklist item..."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAdd}
            >
              Add Item
            </Button>

            <Button
              type="button"
              className="bg-zinc-700 hover:bg-zinc-600"
              onClick={() => {
                setText("");
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