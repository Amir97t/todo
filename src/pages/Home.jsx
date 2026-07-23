import AddTaskCard from "../components/task/AddTaskCard";
import TaskList from "../components/task/TaskList";

export default function Home({ tasks, taskActions }) {
  const { addTask, deleteTask, toggleTask } = taskActions;
  const activeTasks = tasks.filter((task) => !task.completed);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-center text-4xl font-bold">Todo List</h1>
        <AddTaskCard onAddTask={addTask} />
        <TaskList
          title="Active Tasks"
          tasks={activeTasks}
          onDelete={deleteTask}
          onToggle={toggleTask}
        />
      </div>
    </main>
  );
}
