import { useMemo } from "react";

export default function useTaskFilter({ tasks, search, filter, completed }) {
  return useMemo(() => {
    let result = tasks.filter((task) => task.completed === completed);

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((task) => {
        const title = task.title?.toLowerCase() ?? "";
        const description = task.description?.toLowerCase() ?? "";

        return title.includes(query) || description.includes(query);
      });
    }

    if (filter === "newest") {
      result = [...result].sort((a, b) => b.createdAt - a.createdAt);
    }

    if (filter === "oldest") {
      result = [...result].sort((a, b) => a.createdAt - b.createdAt);
    }

    return result;
  }, [tasks, search, filter, completed]);
}
