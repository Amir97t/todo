import { useMemo } from "react";

export default function useTaskFilter({ tasks, search, filter, completed }) {
  return useMemo(() => {
    let filtered = tasks.filter((task) => task.completed === completed);

    if (search.trim()) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          task.description.toLowerCase().includes(search.toLowerCase()),
      );
    }

    switch (filter) {
      case "oldest":
        filtered.sort((a, b) => a.createdAt - b.createdAt);
        break;

      case "az":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;

      case "za":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;

      default:
        filtered.sort((a, b) => b.createdAt - a.createdAt);
    }

    return filtered;
  }, [tasks, search, filter, completed]);
}
