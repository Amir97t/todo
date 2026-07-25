import { useMemo } from "react";

export default function useTaskFilter({ tasks, search, filter, completed }) {
  return useMemo(() => {
    let result = tasks.filter((task) => task.completed === completed);

    if (search.trim()) {
      const q = search.toLowerCase();

      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q),
      );
    }

    switch (filter) {
      case "newest":
        result.sort((a, b) => b.id.localeCompare(a.id));
        break;

      case "oldest":
        result.sort((a, b) => a.id.localeCompare(b.id));
        break;

      default:
        break;
    }

    return result;
  }, [tasks, search, filter, completed]);
}
