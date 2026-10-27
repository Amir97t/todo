import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checklist as checklistApi,
  lists as listsApi,
  tasks as tasksApi,
} from "../lib/api.js";
import { INBOX_LIST_ID } from "../lib/constants.js";
import { readMigrationRecord, runMigration } from "../lib/migration.js";
import { getAccessTokenSubject } from "../lib/authSession.js";
import { mutationKeys } from "../lib/mutationKeys.js";
import { userMessageFor } from "../lib/errorMessages.js";
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

function isSameQuery(previous, next) {
  if (previous === next) return true;
  if (!previous || !next) return false;

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (previous[key] !== next[key]) return false;
  }
  return true;
}

/** Produce a stable string key for a query object. */
export function queryKey(query) {
  if (!query || typeof query !== "object") return "";
  const entries = Object.keys(query)
    .sort()
    .map((key) => [key, query[key]]);
  return JSON.stringify(entries);
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
  const [appStatus, setAppStatus] = useState(() =>
    hasLegacyData() ? "idle" : "loading",
  );
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [lists, setLists] = useState(seedLists);
  const [tasks, setTasks] = useState(seedTasks);

  const [retryToken, setRetryToken] = useState(0);
  // Pages publish the query they want; tasks are whatever the server returns
  // for it. null means no page has asked yet, so nothing is fetched.
  const [taskQuery, setTaskQueryState] = useState(null);
  // Bumped by mutations and by retry to re-run the current query.
  const [taskVersion, setTaskVersion] = useState(0);

  // Query-result cache: keyed by queryKey(query), maps to the last server
  // response for that query. Allows instant display of previously-visited
  // views while a background revalidation runs.
  const queryCacheRef = useRef(new Map());
  // Mutation generation counter to prevent pre-mutation fetches from
  // repopulating invalidated cache entries with stale data.
  const mutationGenRef = useRef(0);
  // Track which query key the displayed tasks correspond to.
  const [displayedQueryKey, setDisplayedQueryKey] = useState("");
  const displayedQueryKeyRef = useRef("");

  function updateDisplayedQueryKey(key) {
    displayedQueryKeyRef.current = key;
    setDisplayedQueryKey(key);
  }

  const requestedKey = queryKey(taskQuery);
  // Reading queryCacheRef during render enables instant display of cached views
  // (stale-while-revalidate) on the very first render before effects run.
  // eslint-disable-next-line react-hooks/refs
  const cachedForRequested = requestedKey ? queryCacheRef.current.get(requestedKey) : undefined;

  const displayedTasks =
    taskQuery === null
      ? tasks
      : cachedForRequested !== undefined
        ? cachedForRequested
        : displayedQueryKey === requestedKey
          ? tasks
          : [];

  // tasksRef always points to the latest tasks array so async callbacks in
  // toggleChecklistItem can read current item state without stale closures.
  const tasksRef = useRef(displayedTasks);
  useEffect(() => {
    tasksRef.current = displayedTasks;
  });

  // Keyed in-flight guard. A second submission of the same operation joins
  // the first promise rather than issuing a second request, so a double-click
  // cannot create a second row. Keys are scoped to the resource acted on, so
  // unrelated mutations never block one another, and the key is released in
  // `finally` so a failure never wedges the action.
  const [pending, setPending] = useState(() => new Set());
  const pendingRef = useRef(new Map());

  // Per-item toggle state for serialized rapid toggles.
  // Maps itemKey → { desired: boolean, confirmed: boolean, inflight: boolean }
  const toggleStateRef = useRef(new Map());
  const togglePromisesRef = useRef(new Map());
  const editPromisesRef = useRef(new Map());

  const isPending = (key) => pending.has(key);

  function setPendingKey(key, held) {
    setPending((previous) => {
      const next = new Set(previous);
      if (held) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function mutate(key, run) {
    const existing = pendingRef.current.get(key);
    if (existing) return existing;

    const promise = (async () => {
      // Only an actual execution clears: a blocked duplicate returns above, so
      // it neither fakes an error nor wipes a real one.
      setActionError(null);
      try {
        return await run();
      } finally {
        pendingRef.current.delete(key);
        setPendingKey(key, false);
      }
    })();

    pendingRef.current.set(key, promise);
    setPendingKey(key, true);
    return promise;
  }

  // Wraps the public action only: internal helpers keep calling the raw
  // function, so a wrapper never awaits the promise it is holding.
  function guard(keyFor, fn) {
    // The wrapper is only ever invoked from event handlers, never during
    // render, so pendingRef is not read while rendering. The compiler's ref
    // rule cannot follow that through the closure.
    // eslint-disable-next-line react-hooks/refs
    return (...args) => mutate(keyFor(...args), () => fn(...args));
  }

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

  const userId = getAccessTokenSubject();
  const ready = appStatus === "ready";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // "idle" keeps the legacy rows on screen; anything else shows loading.
      setAppStatus((prev) => (prev === "idle" ? "idle" : "loading"));
      setError(null);

      try {
        await runMigration(userId);

        const serverLists = await listsApi.get();

        if (cancelled) return;

        const record = readMigrationRecord(userId);
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
        setAppStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(messageOf(cause));
        setAppStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // setStoredSelected is stable: useLocalStorage returns a setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken, userId]);

  // Stable identity so a page's query effect only re-runs when its own
  // inputs change — otherwise publishing an equal query would loop forever.
  // Equal content keeps the previous object, so no refetch is triggered.
  const setTaskQuery = useCallback((next) => {
    setTaskQueryState((previous) =>
      isSameQuery(previous, next) ? previous : next,
    );
  }, []);

  // The server is the only filter and sorter: whatever it returns is what the
  // page renders. Each run aborts the previous request so a slow older
  // response can never overwrite a newer query's results.
  //
  // Query-result cache: when a previously-visited query is requested again,
  // display its cached results immediately and revalidate in the background.
  useEffect(() => {
    if (!ready || taskQuery === null) return undefined;

    const key = queryKey(taskQuery);
    const cached = queryCacheRef.current.get(key);

    if (cached) {
      // Show stale-while-revalidate: display the cached result immediately.
      setTasks(cached);
      updateDisplayedQueryKey(key);
      setQueryLoading(false);
    } else if (displayedQueryKeyRef.current === key) {
      // Revalidating the currently displayed query in the background:
      // keep existing tasks visible and do not show full-page loading.
      setQueryLoading(false);
    } else {
      setQueryLoading(true);
    }

    const controller = new AbortController();
    let stale = false;
    const fetchGen = mutationGenRef.current;

    (async () => {
      try {
        const rows = await tasksApi.get(taskQuery, controller.signal);
        if (stale) return;
        // If a mutation occurred while this fetch was in flight, rows are obsolete.
        if (fetchGen !== mutationGenRef.current) return;

        // Reconcile with active in-flight optimistic toggles if any.
        const reconciledRows = rows.map((task) => {
          if (!task.checklist?.length) return task;
          return {
            ...task,
            checklist: task.checklist.map((item) => {
              const activeToggle = toggleStateRef.current.get(
                `${task.id}:${item.id}`,
              );
              return activeToggle
                ? { ...item, completed: activeToggle.desired }
                : item;
            }),
          };
        });

        // Update cache and display the fresh result.
        queryCacheRef.current.set(key, reconciledRows);
        setTasks(reconciledRows);
        updateDisplayedQueryKey(key);
        setQueryLoading(false);
        setError(null);
      } catch (cause) {
        if (stale || cause?.code === "ABORTED") return;
        setQueryLoading(false);
        updateDisplayedQueryKey(key);
        setError(messageOf(cause));
      }
    })();

    return () => {
      stale = true;
      controller.abort();
    };
  }, [ready, taskQuery, taskVersion]);

  function retry() {
    setActionError(null);
    setRetryToken((token) => token + 1);
    setTaskVersion((version) => version + 1);
  }

  function clearActionError() {
    setActionError(null);
  }

  // A mutation can move a task out of the active query (toggling completed,
  // changing list, deleting a list's tasks). With client-side filtering gone
  // the rendered array must come back from the server to stay truthful.
  // Also invalidates any cached query results that may be affected.
  function refreshTasks() {
    queryCacheRef.current.clear();
    mutationGenRef.current += 1;
    setTaskVersion((version) => version + 1);
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
      setActionError(userMessageFor(cause));
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
      setActionError(userMessageFor(cause));
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
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
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
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  async function deleteTask(id) {
    if (!ready) return refuse("delete a task")();

    try {
      await tasksApi.remove(id);
      setActionError(null);
      setTasks((prev) => prev.filter((task) => task.id !== id));
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  async function toggleTask(id) {
    if (!ready) return refuse("update a task")();
    const current = tasksRef.current.find((task) => task.id === id);
    if (!current) return false;

    try {
      const updated = await tasksApi.update(id, {
        completed: !current.completed,
      });
      setActionError(null);
      setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  async function editTask(id, updatedTask) {
    if (!ready) return refuse("edit a task")();
    if (!tasksRef.current.some((task) => task.id === id)) return false;

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
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
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
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  async function updateChecklistItem(taskId, itemId, patch) {
    if (!ready) return refuse("update a checklist item")();

    const itemKey = `${taskId}:${itemId}`;
    // If a toggle is currently in flight for this item, wait for it to settle
    // so edits and toggles do not race concurrently against the backend.
    const inFlightToggle = togglePromisesRef.current.get(itemKey);
    if (inFlightToggle) {
      try {
        await inFlightToggle;
      } catch {
        /* ignore toggle failure in edit flow */
      }
    }

    const runEdit = async () => {
      try {
        const updated = await checklistApi.update(taskId, itemId, patch);
        setActionError(null);
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  checklist: (task.checklist ?? []).map((item) => {
                    if (item.id !== itemId) return item;
                    const activeToggle = toggleStateRef.current.get(itemKey);
                    return activeToggle
                      ? { ...updated, completed: activeToggle.desired }
                      : updated;
                  }),
                }
              : task,
          ),
        );
        refreshTasks();
        return true;
      } catch (cause) {
        setActionError(userMessageFor(cause));
        return false;
      } finally {
        if (editPromisesRef.current.get(itemKey) === editPromise) {
          editPromisesRef.current.delete(itemKey);
        }
      }
    };

    const editPromise = runEdit();
    editPromisesRef.current.set(itemKey, editPromise);
    return await editPromise;
  }

  /**
   * Serialized rapid-toggle implementation.
   *
   * Every click must:
   *   1. Flip the visible checkbox immediately (optimistic).
   *   2. Not send concurrent conflicting PATCH requests for the same item.
   *   3. Track the latest desired state while a request is running.
   *   4. When the inflight request settles, send a follow-up PATCH only if the
   *      persisted server state still differs from the latest desired state.
   *   5. On failure, restore the last confirmed server state and release all
   *      pending state — never leave the item stuck.
   *   6. Keep independent checklist items fully independent.
   *
   * State per item (stored in toggleStateRef):
   *   { desired: boolean, confirmed: boolean, inflight: boolean }
   *
   * tasksRef.current is always the latest task array, so we never read a stale
   * closure value when multiple toggles race across React state batches.
   */
  async function toggleChecklistItem(taskId, itemId) {
    if (!ready) return refuse("update a checklist item")();

    const itemKey = `${taskId}:${itemId}`;
    const ts = toggleStateRef.current;

    // Determine the current visible (optimistic) state of the item.
    // If we have toggle state tracking this item, desired is the authoritative
    // current intent; otherwise look at the live task state from the ref.
    const currentState = ts.get(itemKey);

    let currentCompleted;
    if (currentState) {
      currentCompleted = currentState.desired;
    } else {
      const task = tasksRef.current.find((candidate) => candidate.id === taskId);
      const item = task?.checklist?.find((candidate) => candidate.id === itemId);
      if (!item) return false;
      currentCompleted = item.completed;
    }

    const newDesired = !currentCompleted;

    // Optimistically flip the visible state immediately.
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              checklist: (t.checklist ?? []).map((c) =>
                c.id === itemId ? { ...c, completed: newDesired } : c,
              ),
            }
          : t,
      ),
    );

    if (currentState?.inflight) {
      // A request is already running — update desired intent and let the
      // inflight request's finally-block handle the follow-up.
      ts.set(itemKey, { ...currentState, desired: newDesired });
      return true;
    }

    // No inflight request: determine confirmed baseline.
    const task = tasksRef.current.find((candidate) => candidate.id === taskId);
    const item = task?.checklist?.find((candidate) => candidate.id === itemId);
    const confirmedCompleted =
      currentState?.confirmed ?? item?.completed ?? currentCompleted;

    // Start tracking this item.
    ts.set(itemKey, {
      desired: newDesired,
      confirmed: confirmedCompleted,
      inflight: true,
    });

    // Run the serialized request loop: keep sending PATCHes until the server
    // state matches the latest desired state, or until a failure occurs.
    const loopPromise = (async () => {
      let succeeded = true;
      while (true) {
        const state = ts.get(itemKey);
        if (!state || state.desired === state.confirmed) break;

        // If a text edit is in flight for this item, wait for it to settle
        // before issuing the completion update to avoid conflicting requests.
        const inFlightEdit = editPromisesRef.current.get(itemKey);
        if (inFlightEdit) {
          try {
            await inFlightEdit;
          } catch {
            /* ignore edit failure in toggle flow */
          }
        }

        const latestState = ts.get(itemKey);
        if (!latestState || latestState.desired === latestState.confirmed) {
          break;
        }

        const targetCompleted = latestState.desired;

        try {
          const updated = await checklistApi.update(taskId, itemId, {
            completed: targetCompleted,
          });
          setActionError(null);

          const latest = ts.get(itemKey);
          if (!latest) break; // state was cleared by a failure

          // Update confirmed to what the server accepted.
          ts.set(itemKey, { ...latest, confirmed: updated.completed });

          // Reconcile with the actual server response for this specific item
          // only if the latest desired intent hasn't superseded it.
          if (latest.desired === updated.completed) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      checklist: (t.checklist ?? []).map((c) => {
                        if (c.id !== itemId) return c;
                        return {
                          ...updated,
                          text: c.text ?? updated.text,
                        };
                      }),
                    }
                  : t,
              ),
            );
          }
        } catch (cause) {
          // Restore to last confirmed server state for this item only.
          const latest = ts.get(itemKey);
          const restoreCompleted = latest?.confirmed ?? confirmedCompleted;

          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    checklist: (t.checklist ?? []).map((c) =>
                      c.id === itemId
                        ? { ...c, completed: restoreCompleted }
                        : c,
                    ),
                  }
                : t,
            ),
          );
          setActionError(userMessageFor(cause));
          ts.delete(itemKey);
          succeeded = false;
          break;
        }

        // After the await, check again: if desired changed while we were awaiting
        // the PATCH, the while loop will issue a follow-up PATCH.
        const latest = ts.get(itemKey);
        if (!latest || latest.desired === latest.confirmed) break;
      }

      // Release the inflight flag and clean up if desired === confirmed.
      const finalState = ts.get(itemKey);
      if (finalState) {
        if (finalState.desired === finalState.confirmed) {
          ts.delete(itemKey);
        } else {
          ts.set(itemKey, { ...finalState, inflight: false });
        }
      }

      if (succeeded) {
        refreshTasks();
      }

      return succeeded;
    })();

    togglePromisesRef.current.set(itemKey, loopPromise);
    try {
      return await loopPromise;
    } finally {
      if (togglePromisesRef.current.get(itemKey) === loopPromise) {
        togglePromisesRef.current.delete(itemKey);
      }
    }
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
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  /* eslint-disable react-hooks/refs */
  const taskActions = {
    addTask: guard(
      (title, description, checklist, listId) => mutationKeys.createTask(listId),
      addTask,
    ),
    deleteTask: guard((id) => mutationKeys.deleteTask(id), deleteTask),
    toggleTask: guard((id) => mutationKeys.toggleTask(id), toggleTask),
    editTask: guard((id) => mutationKeys.editTask(id), editTask),
    addChecklistItem: guard(
      (taskId) => mutationKeys.createChecklistItem(taskId),
      addChecklistItem,
    ),
    updateChecklistItem: guard(
      (taskId, itemId) => mutationKeys.updateChecklistItem(taskId, itemId),
      updateChecklistItem,
    ),
    deleteChecklistItem: guard(
      (taskId, itemId) => mutationKeys.deleteChecklistItem(taskId, itemId),
      deleteChecklistItem,
    ),
    // toggleChecklistItem is NOT wrapped with the global guard — it has its
    // own per-item serialized state machine that handles rapid clicks correctly.
    toggleChecklistItem,
  };

  const publicStatus =
    appStatus === "ready" && queryLoading ? "loading" : appStatus;

  return {
    status: publicStatus,
    error,
    actionError,
    clearActionError,
    isPending,
    retry,
    lists,
    tasks: displayedTasks,
    taskQuery,
    setTaskQuery,
    taskActions,
    addList: guard(() => mutationKeys.createList(), addList),
    renameList: guard((id) => mutationKeys.renameList(id), renameList),
    deleteList: guard((id) => mutationKeys.deleteList(id), deleteList),
    selectedListId,
    setSelectedListId: setStoredSelected,
  };
}
