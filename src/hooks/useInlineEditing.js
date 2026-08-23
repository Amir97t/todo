import { useState } from "react";

export default function useInlineEditing(initialValue = null) {
  const [value, setValue] = useState(initialValue);

  function startEditing(nextValue) {
    // Store a temporary snapshot for the editing form.
    // The parent owns the actual editing state.
    setValue(nextValue);
  }

  return {
    value,
    setValue,
    startEditing,
  };
}
