import Button from "../ui/Button";

export default function ListItem({ list, selected, onSelect }) {
  const isEditing = editingId === list.id;

  return (
    <Button
      onClick={() => onSelect(list.id)}
      className={`w-full justify-start ${
        selected ? "bg-blue-600" : "bg-zinc-800"
      }`}
    >
      {list.name}
    </Button>
  );
}
