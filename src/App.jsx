import Router from "./routes/Router";
import useLocalStorage from "./hooks/useLocalStorage";
import CelestialBackground from "./components/common/CelestialBackground";
import { getSuggestedListIcon } from "./lib/listIcons";

const LISTS_STORAGE_KEY = "todo-app-lists";
const TASKS_STORAGE_KEY = "todo-app-tasks";
const SELECTED_LIST_STORAGE_KEY = "todo-app-selected-list";

const DEFAULT_LISTS = [
  {
    id: "inbox",
    name: "Inbox",
    icon: "inbox",
  },
];

const DEFAULT_TASKS = [];

function taskChecklist(task) {
  return Array.isArray(task.checklist) ? task.checklist : [];
}

export default function App() {
  // App owns application data; persistence is handled by useLocalStorage.
  const [lists, setLists] = useLocalStorage(LISTS_STORAGE_KEY, DEFAULT_LISTS);

  const [tasks, setTasks] = useLocalStorage(TASKS_STORAGE_KEY, DEFAULT_TASKS);

  const [selectedListId, setSelectedListId] = useLocalStorage(
    SELECTED_LIST_STORAGE_KEY,
    "inbox",
  );

  // Every action is async and resolves to an explicit boolean so callers can
  // await the real outcome. Validation happens against the current render's
  // state; the state updater itself stays pure.
  async function addList(name, icon) {
    const trimmed = name.trim();

    if (!trimmed) return false;

    const exists = lists.some(
      (list) => list.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exists) return false;

    const newList = {
      id: crypto.randomUUID(),
      name: trimmed,
      icon: icon || getSuggestedListIcon(trimmed),
    };

    setLists((prev) => [...prev, newList]);
    setSelectedListId(newList.id);

    return true;
  }

  async function renameList(id, name, icon) {
    const trimmed = name.trim();

    if (!trimmed) return false;

    if (!lists.some((list) => list.id === id)) return false;

    const exists = lists.some(
      (list) =>
        list.id !== id && list.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (exists) return false;

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === id
          ? {
              ...list,
              name: trimmed,
              icon: icon ?? list.icon ?? getSuggestedListIcon(trimmed),
            }
          : list,
      ),
    );

    return true;
  }

  async function deleteList(id, deleteTasks = false) {
    // App owns destructive operations because it owns the source data.
    if (id === "inbox") return false;
    if (!lists.some((list) => list.id === id)) return false;

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

    return true;
  }

  async function addTask(title, description, checklist, listId) {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return false;
    if (!lists.some((list) => list.id === listId)) return false;

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

    return true;
  }

  async function deleteTask(id) {
    if (!tasks.some((task) => task.id === id)) return false;

    setTasks((prev) => prev.filter((task) => task.id !== id));

    return true;
  }

  async function toggleTask(id) {
    if (!tasks.some((task) => task.id === id)) return false;

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

    return true;
  }

  async function editTask(id, updatedTask) {
    if (!tasks.some((task) => task.id === id)) return false;

    if (updatedTask.listId) {
      const listExists = lists.some((list) => list.id === updatedTask.listId);

      if (!listExists) return false;
    }

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

    return true;
  }

  async function addChecklistItem(taskId, text) {
    const trimmed = typeof text === "string" ? text.trim() : "";

    if (!trimmed) return false;
    if (!tasks.some((task) => task.id === taskId)) return false;

    const newItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    };

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, checklist: [...taskChecklist(task), newItem] }
          : task,
      ),
    );

    return true;
  }

  async function updateChecklistItem(taskId, itemId, patch) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) return false;
    if (!taskChecklist(task).some((item) => item.id === itemId)) return false;

    setTasks((prev) =>
      prev.map((candidate) =>
        candidate.id === taskId
          ? {
              ...candidate,
              checklist: taskChecklist(candidate).map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : candidate,
      ),
    );

    return true;
  }

  async function toggleChecklistItem(taskId, itemId) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) return false;
    if (!taskChecklist(task).some((item) => item.id === itemId)) return false;

    setTasks((prev) =>
      prev.map((candidate) =>
        candidate.id === taskId
          ? {
              ...candidate,
              checklist: taskChecklist(candidate).map((item) =>
                item.id === itemId
                  ? { ...item, completed: !item.completed }
                  : item,
              ),
            }
          : candidate,
      ),
    );

    return true;
  }

  async function deleteChecklistItem(taskId, itemId) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) return false;
    if (!taskChecklist(task).some((item) => item.id === itemId)) return false;

    setTasks((prev) =>
      prev.map((candidate) =>
        candidate.id === taskId
          ? {
              ...candidate,
              checklist: taskChecklist(candidate).filter(
                (item) => item.id !== itemId,
              ),
            }
          : candidate,
      ),
    );

    return true;
  }

  const taskActions = {
    addTask,
    deleteTask,
    toggleTask,
    editTask,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    toggleChecklistItem,
  };

  return (
    <>
      <CelestialBackground />
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
    </>
  );
}
