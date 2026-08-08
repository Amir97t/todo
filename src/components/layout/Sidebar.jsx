import ListItem from "../list/ListItem";
import NewListForm from "../list/NewListForm";
import { useState } from "react";

export default function Sidebar({
  onAddList,
  lists,
  selectedListId,
  onSelect,
  renameList,
}) {
  // UI state belongs here.
  // App only manages the data.
  const [editingId, setEditingId] = useState(null);
  // Keep editing state close to where it's used.
  // App doesn't need to know which list is being edited.

  function handleRename(id, name) {
    renameList(id, name);
    setEditingId(null);
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex-1 p-5">
        <h2 className="mb-5 text-lg font-bold">Lists</h2>

        <div className="space-y-2">
          {lists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              selected={selectedListId === list.id}
              onSelect={onSelect}
              editingId={editingId}
              onStartEdit={setEditingId}
              onRename={handleRename}
              onCancel={() => setEditingId(null)}
            />
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-zinc-800 p-4">
        <NewListForm onSave={onAddList} />
      </div>
    </aside>
  );
}
