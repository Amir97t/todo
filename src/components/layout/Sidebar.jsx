import Button from "../ui/Button";
import { useState } from "react";

export default function Sidebar({
  onAddList,
  lists,
  selectedListId,
  onSelect,
}) {
  const [name, setName] = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      onAddList(name);
      setName("");
    }
  }

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-5 text-lg font-bold text-white">Lists</h2>
      <Button
        onClick={() => {
          onAddList(name);
          setName("");
        }}
      >
        Add List
      </Button>
      <div className="space-y-2">
        <input
          onKeyDown={handleKeyDown}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {lists.map((list) => (
          <Button
            key={list.id}
            onClick={() => onSelect(list.id)}
            className={`w-full justify-start ${
              selectedListId === list.id ? "bg-blue-600" : "bg-zinc-800"
            }`}
          >
            {list.name}
          </Button>
        ))}
      </div>
    </aside>
  );
}
