import Input from "../ui/Input";
import Button from "../ui/Button";
import useInlineEditing from "../../hooks/useInlineEditing";

export default function ListItem({
  list,
  selected,
  onSelect,
  editingId,
  onStartEdit,
  onRename,
  onCancel,
  onDelete,
}) {
  const { value: name, setValue: setName, startEditing } = useInlineEditing();

  const isCurrentEditingList = editingId === list.id;

  function handleStartEdit() {
    // Keep the current list name inside local editing state.
    // Sidebar/App only need to know which list is being edited.
    startEditing(list.name);
    onStartEdit(list.id);
  }

  function handleSave() {
    const trimmed = name.trim();

    if (!trimmed) return;

    onRename(list.id, trimmed);

    onCancel();
  }

  function handleCancel() {
    onCancel();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleSave();
    }

    if (e.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <div
      className={`mb-2 rounded-lg border p-2 transition ${
        selected ? "border-blue-500 bg-zinc-800" : "border-transparent"
      }`}
    >
      {isCurrentEditingList ? (
        <div className="space-y-2">
          <Input
            className="w-full"
            value={name ?? ""}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-500"
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
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => onSelect(list.id)}
          >
            {list.name}
          </button>
          {/* 
    Inbox is a system list used as the default destination for tasks
    when their original list is deleted.
    Keep it stable so list deletion always has a valid fallback.
  */}
          {list.id !== "inbox" && (
            <div className="flex shrink-0 gap-2">
              <Button
                className="bg-zinc-700 hover:bg-zinc-600"
                onClick={handleStartEdit}
              >
                Edit
              </Button>

              <Button
                className="bg-red-700 hover:bg-red-600"
                onClick={() => onDelete(list)}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
