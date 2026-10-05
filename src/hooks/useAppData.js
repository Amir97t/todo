import { useEffect, useMemo, useState } from "react";
import {
  checklist as checklistApi,
  lists as listsApi,
  tasks as tasksApi,
} from "../lib/api.js";
import { INBOX_LIST_ID } from "../lib/constants.js";
import { readMigrationRecord, runMigration } from "../lib/migration.js";
import useLocalStorage from "./useLocalStorage.js";

const LEGACY_LISTS_KEY = "todo-app-lists";
const LEGACY_TASKS_KEY = "todo-app-tasks";
const SELECTED_KEY = "todo-app-selected-list";

function readLegacy(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasLegacyData() {
  return (
    localStorage.getItem(LEGACY_LISTS_KEY) !== null ||
    localStorage.getItem(LEGACY_TASKS_KEY) !== null
  );
}

// The legacy rows use the "inbox" sentinel. Remapping on read keeps every
// component on the real UUID from the first paint without ever rewriting the
// stored data.
function seedLists() {
  const rows = readLegacy(LEGACY_LISTS_KEY) ?? [];
  return rows.map((row) =>
    row?.id === "inbox" ? { ...row, id: INBOX_LIST_ID } : row,
  );
}

function seedTasks() {
  const rows = readLegacy(LEGACY_TASKS_KEY) ?? [];
  return rows.map((row) =>
    row?.listId === "inbox" ? { ...row, listId: INBOX_LIST_ID } : row,
  );
}

function messageOf(error) {
  return error?.message || "Something went wrong.";
}

/**
 * Sole owner of server-owned data. Components receive state and actions from
 * here and never touch fetch, the API client, or the legacy storage keys.
 *
 * While `status` is "idle" the app renders the legacy rows so nothing blanks
 * out during migration, but mutations are refused until the store has
 * switched — a write made mid-migration would be discarded with the state
 * swap, which is the one way this boundary could lose data.
 */
export default function useAppData() {
  const [status, setStatus] = useState(() =>
    hasLegacyData() ? "idle" : "loading",
  );
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [lists, setLists] = useState(seedLists);
  const [tasks, setTasks] = useState(seedTasks);
  const [retryToken, setRetryToken] = useState(0);

  const [storedSelected, setStoredSelected] = useLocalStorage(
    SELECTED_KEY,
    INBOX_LIST_ID,
  );

  const selectedListId = useMemo(() => {
    if (!storedSelected || storedSelected === "inbox") return INBOX_LIST_ID;
    if (lists.length > 0 && !lists.some((list) => list.id === storedSelected)) {
      return INBOX_LIST_ID;
    }
    return storedSelected;
  }, [storedSelected, lists]);

  const ready = status === "ready";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // "idle" keeps the legacy rows on screen; anything else shows loading.
      setStatus((prev) => (prev === "idle" ? "idle" : "loading"));
      setError(null);

      try {
        await runMigration();

        const [serverLists, serverTasks] = await Promise.all([
          listsApi.get(),
          tasksApi.get(),
        ]);

        if (cancelled) return;

        const record = readMigrationRecord();
        const listIdMap = record?.listIdMap ?? {};

        setStoredSelected((previous) => {
          if (!previous || previous === "inbox") return INBOX_LIST_ID;
          if (listIdMap[previous]) return listIdMap[previous];
          if (!serverLists.some((list) => list.id === previous)) {
            return INBOX_LIST_ID;
          }
          return previous;
        });

        setLists(serverLists);
        setTasks(serverTasks);
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(messageOf(cause));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // setStoredSelected is stable: useLocalStorage returns a setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  function retry() {
    setActionError(null);
    setRetryToken((token) => token + 1);
  }

  function refuse(action) {
    return () => {
      setActionError(`Cannot ${action} until the data has finished loading.`);
      return false;
    };
  }

  async function addList(name, icon) {
    if (!ready) return refuse("create a list")();
    const trimmed = name.trim();
    if (!trimmed) return false;

    try {
      const created = await listsApi.create(
        icon ? { name: trimmed, icon } : { name: trimmed },
      );
      setActionError(null);
      setLists((prev) => [...prev, created]);
      setStoredSelected(created.id);
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function renameList(id, name, icon) {
    if (!ready) return refuse("rename a list")();
    const trimmed = name.trim();
    if (!trimmed) return false;

    try {
      const updated = await listsApi.update(
        id,
        icon ? { name: trimmed, icon } : { name: trimmed },
      );
      setActionError(null);
      setLists((prev) => prev.map((list) => (list.id === id ? updated : list)));
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function deleteList(id, deleteTasks = false) {
    if (!ready) return refuse("delete a list")();
    if (id === INBOX_LIST_ID) return false;

    try {
      await listsApi.remove(id, {
        strategy: deleteTasks ? "delete" : "relocate",
      });
      setActionError(null);
      setLists((prev) => prev.filter((list) => list.id !== id));
      if (selectedListId === id) setStoredSelected(INBOX_LIST_ID);
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function addTask(title, description, checklist, listId) {
    if (!ready) return refuse("create a task")();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;

    try {
      const created = await tasksApi.create({
        title: trimmedTitle,
        description:
          typeof description === "string" ? description.trim() : "",
        completed: false,
        listId,
        checklist: (checklist ?? []).map((item) => ({
          text: typeof item?.text === "string" ? item.text : "",
        })),
      });
      setActionError(null);
      setTasks((prev) => [...prev, created]);
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function deleteTask(id) {
    if (!ready) return refuse("delete a task")();

    try {
      await tasksApi.remove(id);
      setActionError(null);
      setTasks((prev) => prev.filter((task) => task.id !== id));
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function toggleTask(id) {
    if (!ready) return refuse("update a task")();
    const current = tasks.find((task) => task.id === id);
    if (!current) return false;

    try {
      const updated = await tasksApi.update(id, {
        completed: !current.completed,
      });
      setActionError(null);
      setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function editTask(id, updatedTask) {
    if (!ready) return refuse("edit a task")();
    if (!tasks.some((task) => task.id === id)) return false;

    const body = {};
    if (updatedTask.title !== undefined) body.title = updatedTask.title;
    if (updatedTask.description !== undefined) {
      body.description = updatedTask.description;
    }
    if (updatedTask.completed !== undefined) body.completed = updatedTask.completed;
    if (updatedTask.listId !== undefined) body.listId = updatedTask.listId;

    if (Object.keys(body).length === 0) return true;

    try {
      const updated = await tasksApi.update(id, body);
      setActionError(null);
      setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function addChecklistItem(taskId, text) {
    if (!ready) return refuse("add a checklist item")();
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (!trimmed) return false;

    try {
      const created = await checklistApi.create(taskId, { text: trimmed });
      setActionError(null);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, checklist: [...(task.checklist ?? []), created] }
            : task,
        ),
      );
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function updateChecklistItem(taskId, itemId, patch) {
    if (!ready) return refuse("update a checklist item")();

    try {
      const updated = await checklistApi.update(taskId, itemId, patch);
      setActionError(null);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                checklist: (task.checklist ?? []).map((item) =>
                  item.id === itemId ? updated : item,
                ),
              }
            : task,
        ),
      );
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
  }

  async function toggleChecklistItem(taskId, itemId) {
    if (!ready) return refuse("update a checklist item")();
    const task = tasks.find((candidate) => candidate.id === taskId);
    const item = task?.checklist?.find((candidate) => candidate.id === itemId);
    if (!item) return false;

    return updateChecklistItem(taskId, itemId, { completed: !item.completed });
  }

  async function deleteChecklistItem(taskId, itemId) {
    if (!ready) return refuse("delete a checklist item")();

    try {
      await checklistApi.remove(taskId, itemId);
      setActionError(null);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                checklist: (task.checklist ?? []).filter(
                  (item) => item.id !== itemId,
                ),
              }
            : task,
        ),
      );
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    }
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

  return {
    status,
    error,
    actionError,
    retry,
    lists,
    tasks,
    taskActions,
    addList,
    renameList,
    deleteList,
    selectedListId,
    setSelectedListId: setStoredSelected,
  };
}
