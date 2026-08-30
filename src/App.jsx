import Router from "./routes/Router";
import useLocalStorage from "./hooks/useLocalStorage";

const LISTS_STORAGE_KEY = "todo-app-lists";
const TASKS_STORAGE_KEY = "todo-app-tasks";
const SELECTED_LIST_STORAGE_KEY = "todo-app-selected-list";

const DEFAULT_LISTS = [
  {
    id: "inbox",
    name: "Inbox",
  },
];

const DEFAULT_TASKS = [];

export default function App() {
  // App owns application data; persistence is handled by useLocalStorage.
  const [lists, setLists] = useLocalStorage(LISTS_STORAGE_KEY, DEFAULT_LISTS);

  const [tasks, setTasks] = useLocalStorage(TASKS_STORAGE_KEY, DEFAULT_TASKS);

  const [selectedListId, setSelectedListId] = useLocalStorage(
    SELECTED_LIST_STORAGE_KEY,
    "inbox",
  );

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

    // Open the newly created list immediately.
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

  function deleteList(id, deleteTasks = false) {
    // App owns destructive operations because it owns the source data.
    if (id === "inbox") return;

    if (deleteTasks) {
      setTasks((prev) => prev.filter((task) => task.listId !== id));
    } else {
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

    if (selectedListId === id) {
      setSelectedListId("inbox");
    }
  }

  function addTask(title, description, checklist, listId) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    const newTask = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      description: description.trim(),
      checklist,
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

  const taskActions = {
    addTask,
    deleteTask,
    toggleTask,
    editTask,
  };

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
