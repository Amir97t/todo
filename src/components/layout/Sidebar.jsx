import Button from "../ui/Button";

export default function Sidebar({ lists, selectedListId, onSelect }) {
  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-5 text-lg font-bold text-white">Lists</h2>

      <div className="space-y-2">
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
