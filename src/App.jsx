import { useMemo, useState, useEffect } from "react";
import Router from "./routes/Router";

const STORAGE_KEY = "todo-app-tasks";

export default function App() {
  const [lists, setLists] = useState([
    {
      id: "inbox",
      name: "Inbox",
    },
  ]);
  const [selectedListId, setSelectedListId] = useState("inbox");
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  function addTask(title, description, listId) {
    if (!title.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      title,
      description,
      listId,
      completed: false,
      createdAt: Date.now(),
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

  function editTask(id, updatedTask) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              ...updatedTask,
            }
          : task,
      ),
    );
  }

  const taskActions = useMemo(
    () => ({
      addTask,
      deleteTask,
      toggleTask,
      editTask,
    }),
    [],
  );

  return (
    <Router
      tasks={tasks}
      lists={lists}
      selectedListId={selectedListId}
      setSelectedListId={setSelectedListId}
      taskActions={taskActions}
    />
  );
}
