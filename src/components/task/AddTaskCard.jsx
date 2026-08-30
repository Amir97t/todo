import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/Card";

export default function AddTaskCard({ onAddTask }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [checklist, setChecklist] = useState([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemText, setItemText] = useState("");

  function handleAddItem() {
    const text = itemText.trim();

    if (!text) return;

    const newItem = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };

    setChecklist((prev) => [...prev, newItem]);
    setItemText("");
  }

  function handleItemKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }

    if (e.key === "Escape") {
      setItemText("");
      setIsAddingItem(false);
    }
  }

  function handleRemoveItem(itemId) {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleSubmit() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    // AddTaskCard only collects form data.
    // The parent decides which list the task belongs to.
    onAddTask(trimmedTitle, description.trim(), checklist);

    setTitle("");
    setDescription("");
    setChecklist([]);
    setItemText("");
    setIsAddingItem(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Task</CardTitle>

        <CardDescription>
          Create a task with an optional description and checklist.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          placeholder="Description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="space-y-3">
          {!isAddingItem ? (
            <Button
              type="button"
              className="bg-zinc-800 hover:bg-zinc-700"
              onClick={() => setIsAddingItem(true)}
            >
              + Add checklist item
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="Checklist item..."
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                onKeyDown={handleItemKeyDown}
              />

              <div className="flex gap-2">
                <Button type="button" onClick={handleAddItem}>
                  Add Item
                </Button>

                <Button
                  type="button"
                  className="bg-zinc-700 hover:bg-zinc-600"
                  onClick={() => {
                    setItemText("");
                    setIsAddingItem(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {checklist.length > 0 && (
            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-zinc-300">☐ {item.text}</span>

                  <button
                    type="button"
                    className="text-xs text-red-400 hover:text-red-300"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button type="button" onClick={handleSubmit}>
          Add Task
        </Button>
      </CardFooter>
    </Card>
  );
}
