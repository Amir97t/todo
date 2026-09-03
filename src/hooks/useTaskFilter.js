import { useMemo } from "react";

export default function useTaskFilter({
  tasks,
  search,
  filter,
  completed,
  selectedListId,
}) {
  return useMemo(() => {
    let filtered = tasks.filter((task) => task.completed === completed);

    // Apply list filtering only when a list is explicitly selected.
    // This keeps Completed as a global view while Inbox can stay list-specific.
    if (selectedListId && !search.trim()) {
      filtered = filtered.filter((task) => task.listId === selectedListId);
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query),
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
  }, [tasks, search, filter, completed, selectedListId]);
}
