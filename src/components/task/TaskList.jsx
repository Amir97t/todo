import TaskItem from "./TaskItem";

export default function TaskList({
  title,
  tasks,
  onDelete,
  onToggle,
}) {
  return (
    <section className="mt-10">

      <h2 className="mb-5 text-2xl font-bold">
        {title}
      </h2>

      <div className="space-y-4">

        {tasks.length === 0 ? (
          <p className="text-zinc-500">
            No tasks.
          </p>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))
        )}

      </div>

    </section>
  );
}