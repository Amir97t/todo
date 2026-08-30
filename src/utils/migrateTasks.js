export default function migrateTasks(tasks) {
  return tasks.map((task) => {
    // Keep already-migrated tasks unchanged.
    if (Array.isArray(task.description)) {
      return task;
    }

    // Convert old string descriptions into one checklist item.
    if (
      typeof task.description === "string" &&
      task.description.trim()
    ) {
      return {
        ...task,
        description: [
          {
            id: crypto.randomUUID(),
            text: task.description.trim(),
            completed: false,
          },
        ],
      };
    }

    // Normalize empty or invalid descriptions.
    return {
      ...task,
      description: [],
    };
  });
}