import { useState, useRef, useEffect } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";

export default function NewListForm({ onSave }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  function handleSave() {
    const value = name.trim();

    if (!value) return;

    const saved = onSave(value);

    // Keep the form open when saving fails, for example
    // when another list already has the same name.
    if (!saved) return;

    setName("");
    setIsOpen(false);
  }

  function handleCancel() {
    setName("");
    setIsOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleSave();
    }

    if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (!isOpen) {
    return (
      <Button className="w-full justify-start" onClick={() => setIsOpen(true)}>
        + New List
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
      <Input
        ref={inputRef}
        value={name}
        placeholder="List name..."
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex gap-2">
        <Button
          className="flex-1 bg-blue-600 hover:bg-blue-500"
          onClick={handleSave}
        >
          Save
        </Button>

        <Button
          className="flex-1 bg-zinc-700 hover:bg-zinc-600"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
