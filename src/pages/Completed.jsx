import TaskList from "../components/task/TaskList";
import Navbar from "../components/layout/Navbar";

export default function Completed({ tasks, taskActions }) {
  const { deleteTask, toggleTask } = taskActions;
  const completedTasks = tasks.filter((task) => task.completed); //needs a refactor

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-center text-4xl font-bold">Completed Tasks</h1>
        <Navbar />
        <TaskList
          title="Completed"
          tasks={completedTasks}
          onDelete={deleteTask}
          onToggle={toggleTask}
        />
      </div>
    </main>
  );
}
