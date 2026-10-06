/**
 * Keys for the in-flight mutation guard.
 *
 * Scoped by the resource being acted on, so deleting task A never blocks
 * deleting task B, while a double submission of the same operation collapses
 * onto one request. Creates have no id yet, so they key on their target
 * (the list a task belongs to, the task a checklist item joins).
 */
export const mutationKeys = {
  createList: () => "list:create",
  renameList: (listId) => `list:rename:${listId}`,
  deleteList: (listId) => `list:delete:${listId}`,

  createTask: (listId) => `task:create:${listId || "unknown"}`,
  editTask: (taskId) => `task:edit:${taskId}`,
  toggleTask: (taskId) => `task:toggle:${taskId}`,
  deleteTask: (taskId) => `task:delete:${taskId}`,

  createChecklistItem: (taskId) => `checklist:create:${taskId}`,
  updateChecklistItem: (taskId, itemId) => `checklist:update:${taskId}:${itemId}`,
  deleteChecklistItem: (taskId, itemId) => `checklist:delete:${taskId}:${itemId}`,
};
