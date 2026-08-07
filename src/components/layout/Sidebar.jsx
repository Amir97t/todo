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
  const [editingId, setEditingId] = useState(null);
  // Keep editing state close to where it's used.
  // App doesn't need to know which list is being edited.
  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900 p-5">
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
            onCancel={() => setEditingId(null)}
            onRename={(id, name) => {
              renameList(id, name);
              setEditingId(null);
            }}
          />
        ))}
      </div>
      <div className="mt-6">
        <NewListForm onAddList={onAddList} />
      </div>
    </aside>
  );
}
