import { useState } from "react";
import Input from "../ui/Input";

export default function NewListForm({ onAddList }) {
  const [name, setName] = useState("");

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;

    onAddList(name);

    setName("");
  }

  return (
    <Input
      placeholder="New List..."
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
