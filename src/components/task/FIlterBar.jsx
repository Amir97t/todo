import Button from "../ui/Button";

export default function FilterBar({ onChange }) {
  return (
    <div className="flex gap-3">
      <Button onClick={() => onChange("all")}>All</Button>
      <Button onClick={() => onChange("active")}>Active</Button>
      <Button onClick={() => onChange("complete")}>Completed</Button>
    </div>
  );
}
