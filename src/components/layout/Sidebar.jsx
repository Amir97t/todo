import ListItem from "../list/ListItem";
import NewListForm from "../list/NewListForm";
import { useState } from "react";
import ConfirmDialog from "../common/ConfirmDialog";

export default function Sidebar({
  addList,
  lists,
  selectedListId,
  onSelect,
  renameList,
  deleteList,
}) {
  // UI state belongs here.
  // App only manages the data.
  const [editingId, setEditingId] = useState(null);
  // Keep editing state close to where it's used.
  // App doesn't need to know which list is being edited.

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  // Collapse state belongs to the layout component.
  // App does not need to know whether the sidebar is visually open.

  function handleRename(id, name) {
    renameList(id, name);
    setEditingId(null);
  }

  function handleDeleteRequest(list) {
    // Store the selected list so the confirmation UI knows what to delete.
    setDeleteTarget(list);
  }

  function handleDeleteList() {
    if (!deleteTarget) return;

    deleteList(deleteTarget.id, false);
    setDeleteTarget(null);
  }

  function handleDeleteListAndTasks() {
    if (!deleteTarget) return;

    deleteList(deleteTarget.id, true);
    setDeleteTarget(null);
  }

  return (
    <aside
      className={`flex h-screen flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex-1 p-5">
        <button
          type="button"
          className="mb-5 text-left text-zinc-400 hover:text-white"
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          ☰
        </button>
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
              onDelete={handleDeleteRequest}
              collapsed={isCollapsed}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-800 p-4">
        <NewListForm onSave={addList} />
      </div>

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete "${deleteTarget.name}"?`}
          description="Choose what should happen to the tasks inside this list."
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete List"
          onConfirm={handleDeleteList}
          secondaryLabel="Delete List & Tasks"
          onSecondaryConfirm={handleDeleteListAndTasks}
        />
      )}
    </aside>
  );
}
