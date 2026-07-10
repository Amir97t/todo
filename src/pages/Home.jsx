import { useMemo, useState } from "react";

import AddTaskCard from "../components/task/AddTaskCard";
import TaskList from "../components/task/TaskList";

export default function Home() {
  const [tasks, setTasks] = useState([]);

  function addTask(title, description) {
    if (!title.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      title,
      description,
      completed: false,
    };

    setTasks((prev) => [...prev, newTask]);
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  function toggleTask(id) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  }

  const todoTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks]
  );

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.completed),
    [tasks]
  );

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">

        <h1 className="mb-2 text-center text-5xl font-bold">
          Todo List
        </h1>

        <p className="mb-10 text-center text-zinc-400">
          Organize your daily tasks.
        </p>

        <AddTaskCard onAddTask={addTask} />

        <TaskList
          title="Todo"
          tasks={todoTasks}
          onDelete={deleteTask}
          onToggle={toggleTask}
        />

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