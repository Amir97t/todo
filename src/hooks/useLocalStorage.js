import { useEffect, useState } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const savedValue = localStorage.getItem(key);

    if (savedValue === null) {
      return initialValue;
    }

    try {
      return JSON.parse(savedValue);
    } catch {
      // Fall back to the initial value when stored data is invalid.
      return initialValue;
    }
  });

  useEffect(() => {
    // localStorage is an external system,
    // so syncing state here is an appropriate use of Effect.
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
