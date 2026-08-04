import Button from "../ui/Button";

export default function Sidebar({ lists, selectedListId, onSelect }) {
  return (
    <aside className="w-60 border-r border-zinc-800 p-4">
      <h2 className="mb-4 text-lg font-bold">Lists</h2>

      <div className="space-y-2">
        {lists.map((list) => (
          <Button
            key={list.id}
            onClick={() => onSelect(list.id)}
            className={
              selectedListId === list.id ? "w-full bg-red-600" : "w-full"
            }
          >
            {list.name}
          </Button>
        ))}
      </div>
    </aside>
  );
}
