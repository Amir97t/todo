import { useMemo, useState, useEffect } from "react";
import Router from "./routes/Router";

const LISTS_STORAGE_KEY = "todo-app-lists";
const TASKS_STORAGE_KEY = "todo-app-tasks";
const SELECTED_LIST_STORAGE_KEY = "todo-app-selected-list";

export default function App() {
  // App owns persistent application data.
  // Child components receive data and actions instead of owning global state.
  const [lists, setLists] = useState(() => {
    const saved = localStorage.getItem(LISTS_STORAGE_KEY);

    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "inbox",
            name: "Inbox",
          },
        ];
  });

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY);

    return saved ? JSON.parse(saved) : [];
  });

  // Keep the currently selected list persistent across page reloads.
  const [selectedListId, setSelectedListId] = useState(() => {
    return localStorage.getItem(SELECTED_LIST_STORAGE_KEY) || "inbox";
  });

  useEffect(() => {
    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(SELECTED_LIST_STORAGE_KEY, selectedListId);
  }, [selectedListId]);

  function addList(name) {
    const trimmed = name.trim();

    if (!trimmed) return;

    const exists = lists.some(
      (list) => list.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exists) return;

    const newList = {
      id: crypto.randomUUID(),
      name: trimmed,
    };

    setLists((prev) => [...prev, newList]);

    // Automatically open the newly created list.
    setSelectedListId(newList.id);
  }

  function renameList(id, name) {
    const trimmed = name.trim();

    if (!trimmed) return;

    const exists = lists.some(
      (list) =>
        list.id !== id && list.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exists) return;

    setLists((prev) =>
      prev.map((list) =>
        list.id === id
          ? {
              ...list,
              name: trimmed,
            }
          : list,
      ),
    );
  }

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

  function deleteList(id, deleteTasks = false) {
    // App owns destructive data operations because it is the source of truth.
    if (id === "inbox") return;

    if (deleteTasks) {
      // Delete the list and all tasks that belong to it.
      setTasks((prev) => prev.filter((task) => task.listId !== id));
    } else {
      // Keep the tasks alive by moving them back to Inbox.
      setTasks((prev) =>
        prev.map((task) =>
          task.listId === id
            ? {
                ...task,
                listId: "inbox",
              }
            : task,
        ),
      );
    }

    setLists((prev) => prev.filter((list) => list.id !== id));

    // Prevent the app from staying on a list that no longer exists.
    if (selectedListId === id) {
      setSelectedListId("inbox");
    }
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  function toggleTask(id) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
            }
          : task,
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
      taskActions={taskActions}
      lists={lists}
      addList={addList}
      renameList={renameList}
      deleteList={deleteList}
      selectedListId={selectedListId}
      setSelectedListId={setSelectedListId}
    />
  );
}
