import { useMemo, useState } from "react";
import Router from "./routes/Router";

export default function App() {
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
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  const taskActions = useMemo(
    () => ({
      addTask,
      deleteTask,
      toggleTask,
    }),
    [],
  );

  return <Router tasks={tasks} taskActions={taskActions} />;
}
