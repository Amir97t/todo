import Input from "../ui/Input";

export default function SearchBar({ value, onChange }) {
  return (
    <Input
      placeholder="Search tasks..."
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}
