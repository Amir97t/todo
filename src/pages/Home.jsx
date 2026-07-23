import AddTaskCard from "../components/task/AddTaskCard";
import TaskList from "../components/task/TaskList";
import Navbar from "../components/layout/Navbar";

export default function Home({ tasks, taskActions }) {
  const { addTask, deleteTask, toggleTask } = taskActions;
  const activeTasks = tasks.filter((task) => !task.completed); //needs a refactor

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-center text-4xl font-bold">Todo List</h1>
        <Navbar />
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
