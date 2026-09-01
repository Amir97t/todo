import ListItem from "../list/ListItem";
import NewListForm from "../list/NewListForm";
import { useState } from "react";
import ConfirmDialog from "../common/ConfirmDialog";
import Button from "../ui/Button";

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
    const renamed = renameList(id, name);

    if (!renamed) return;

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
  function handleNewListClick() {
    // Expand the sidebar before showing the full list creation form.
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  }

  return (
    <>
      <aside
        className={`flex h-screen flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 transition-all duration-200 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div
            className={`mb-5 flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!isCollapsed && (
              <h2 className="text-lg font-bold text-white">Lists</h2>
            )}

            <button
              type="button"
              className="rounded p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              onClick={() => setIsCollapsed((prev) => !prev)}
            >
              ☰
            </button>
          </div>

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

        <div className="shrink-0 border-t border-zinc-800 p-3">
          {isCollapsed ? (
            <Button
              type="button"
              className="flex h-10 w-full items-center justify-center px-0"
              onClick={handleNewListClick}
              title="New List"
            >
              +
            </Button>
          ) : (
            <NewListForm onSave={addList} />
          )}
        </div>
      </aside>

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
    </>
  );
}
