import TaskItem from "./TaskItem";

export default function TaskList({
  title,
  tasks,
  taskActions,
  editingId,
  onStartEdit,
}) {
  if (tasks.length === 0) {
    return (
      <section className="mt-6">
        <p className="text-sm text-(--text-faint)">No tasks.</p>
      </section>
    );
  }

  return (
    <section>
      {title && (
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-(--text-faint)">
          {title} — {tasks.length}
        </h2>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            taskActions={taskActions}
            editingId={editingId}
            onStartEdit={onStartEdit}
          />
        ))}
      </div>
    </section>
  );
}
