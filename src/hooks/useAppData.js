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

/** Parse a queryKey back into a query object, or null if invalid. */
export function parseQueryKey(key) {
  try {
    if (!key) return null;
    const entries = JSON.parse(key);
    if (!Array.isArray(entries)) return null;
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

export function parseTimestamp(val) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function compareIds(aId, bId) {
  if (aId === bId) return 0;
  if (aId === null || aId === undefined || bId === null || bId === undefined) {
    return null;
  }
  if (typeof aId === "number" && typeof bId === "number") {
    if (!Number.isFinite(aId) || !Number.isFinite(bId)) return null;
    return aId < bId ? -1 : 1;
  }
  if (typeof aId !== "string" && typeof aId !== "number") return null;
  if (typeof bId !== "string" && typeof bId !== "number") return null;

  const aStr = String(aId).trim();
  const bStr = String(bId).trim();
  if (!aStr || !bStr) return null;
  if (aStr === bStr) return 0;
  return aStr < bStr ? -1 : 1;
}

export function compareNewestOrder(a, b) {
  const aTime = parseTimestamp(a?.createdAt);
  const bTime = parseTimestamp(b?.createdAt);
  if (aTime === null || bTime === null) return null;

  if (aTime !== bTime) {
    return aTime > bTime ? 1 : -1;
  }

  const idComp = compareIds(a?.id, b?.id);
  if (idComp === null) return null;
  return idComp;
}

/**
 * Inserts a task into a newest-first sorted task list at its exact chronological
 * position based on createdAt DESC, then id DESC tie-breaker, matching the backend contract.
 * Updates in-place if the task already exists, preserving existing position.
 * Returns null if timestamp or id cannot be compared reliably, signalling cache invalidation.
 */
export function insertOrUpdateNewest(list, task) {
  if (!Array.isArray(list) || !task || typeof task !== "object") return null;

  // 1. If task already exists in list, update it in place, preserving existing position and avoiding duplicates.
  const existingIndex = list.findIndex((t) => t.id === task.id);
  if (existingIndex !== -1) {
    const result = [];
    let placed = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === task.id) {
        if (!placed) {
          result.push(task);
          placed = true;
        }
      } else {
        result.push(list[i]);
      }
    }
    return result;
  }

  // 2. Validate that the new task has a reliable timestamp and identifier.
  const taskTime = parseTimestamp(task.createdAt);
  const taskIdValid =
    task.id !== null && task.id !== undefined && String(task.id).trim() !== "";
  if (taskTime === null || !taskIdValid) {
    return null;
  }

  if (!list.length) return [task];

  // 3. Find insertion index matching newest sort (createdAt DESC, then id DESC).
  let insertIndex = -1;
  for (let i = 0; i < list.length; i++) {
    const comp = compareNewestOrder(task, list[i]);
    if (comp === null) {
      // Unreliable comparison with an element in list
      return null;
    }
    if (comp > 0) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    return [...list, task];
  }
  return [...list.slice(0, insertIndex), task, ...list.slice(insertIndex)];
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
      : displayedQueryKey === requestedKey
        ? tasks
        : cachedForRequested !== undefined
          ? cachedForRequested
          : [];

  // tasksRef always points to the latest tasks array so async callbacks in
  // toggleChecklistItem and toggleTask can read current item state without stale closures.
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

  // Per-task toggle state for serialized rapid toggles.
  // Maps taskId → { desired: boolean, confirmed: boolean, inflight: boolean }
  const taskToggleStateRef = useRef(new Map());
  const taskTogglePromisesRef = useRef(new Map());

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

    if (displayedQueryKeyRef.current === key) {
      // Revalidating the currently displayed query in the background:
      // keep existing live tasks visible (preserving optimistic updates)
      // and do not show full-page loading.
      setQueryLoading(false);
    } else if (cached) {
      // Switching to a previously-cached query: display the cached result immediately.
      setTasks(cached);
      updateDisplayedQueryKey(key);
      setQueryLoading(false);
    } else {
      // Switching to an uncached query: show loading state.
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
        if (fetchGen !== mutationGenRef.current) {
          if (queryCacheRef.current.has(key)) {
            setTasks(queryCacheRef.current.get(key));
          }
          setQueryLoading(false);
          return;
        }

        const parsed = parseQueryKey(key);

        // Reconcile with active in-flight optimistic toggles if any.
        let reconciledRows = rows.map((task) => {
          let currentTask = task;
          const activeTaskToggle = taskToggleStateRef.current.get(task.id);
          if (activeTaskToggle) {
            currentTask = {
              ...currentTask,
              completed: activeTaskToggle.desired,
            };
          }
          if (!currentTask.checklist?.length) return currentTask;
          return {
            ...currentTask,
            checklist: currentTask.checklist.map((item) => {
              const activeToggle = toggleStateRef.current.get(
                `${task.id}:${item.id}`,
              );
              return activeToggle
                ? { ...item, completed: activeToggle.desired }
                : item;
            }),
          };
        });

        // Filter out any task whose in-flight desired state contradicts the query's completion filter
        if (parsed && parsed.completed !== undefined) {
          reconciledRows = reconciledRows.filter(
            (task) => task.completed === parsed.completed,
          );
        }

        // Reconcile in-flight tasks that match this query's filters but were not yet returned by the server
        if (parsed) {
          const isSearch = Boolean(parsed.q && String(parsed.q).trim());
          const isDefaultSort = !parsed.sort || parsed.sort === "newest";

          if (!isSearch && isDefaultSort && parsed.completed !== undefined) {
            for (const [, toggle] of taskToggleStateRef.current.entries()) {
              if (toggle.desired === parsed.completed) {
                const taskSnap = toggle.taskSnapshot;
                if (!taskSnap) continue;
                if (
                  parsed.listId &&
                  taskSnap.listId &&
                  parsed.listId !== taskSnap.listId
                ) {
                  continue;
                }
                if (!reconciledRows.some((t) => t.id === taskSnap.id)) {
                  const candidate = { ...taskSnap, completed: toggle.desired };
                  const inserted = insertOrUpdateNewest(reconciledRows, candidate);
                  if (inserted !== null) {
                    reconciledRows = inserted;
                  }
                }
              }
            }
          }
        }

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

  // A mutation increments mutationGenRef and bumps taskVersion to re-run the
  // current query against the server in the background without clearing warm caches.
  function refreshTasks() {
    mutationGenRef.current += 1;
    setTaskVersion((version) => version + 1);
  }

  function removeTaskFromAllCaches(taskId) {
    for (const [key, cachedList] of queryCacheRef.current.entries()) {
      if (cachedList.some((task) => task.id === taskId)) {
        queryCacheRef.current.set(
          key,
          cachedList.filter((task) => task.id !== taskId),
        );
      }
    }
  }

  function updateTaskInAllCaches(taskId, updater) {
    for (const [key, cachedList] of queryCacheRef.current.entries()) {
      if (cachedList.some((task) => task.id === taskId)) {
        queryCacheRef.current.set(
          key,
          cachedList.map((task) => (task.id === taskId ? updater(task) : task)),
        );
      }
    }
  }

  function applyTaskCompletionToCaches(updatedTask) {
    const isCompleted = updatedTask.completed;

    for (const [key, cachedList] of queryCacheRef.current.entries()) {
      const parsed = parseQueryKey(key);
      if (!parsed) {
        queryCacheRef.current.delete(key);
        continue;
      }

      const isSearch = Boolean(parsed.q && String(parsed.q).trim());
      const isDefaultSort = !parsed.sort || parsed.sort === "newest";

      // 1. If the cached query explicitly filters for the opposite completion state,
      // it is always safe to remove the task from that cache.
      if (parsed.completed === false && isCompleted) {
        queryCacheRef.current.set(
          key,
          cachedList.filter((t) => t.id !== updatedTask.id),
        );
        continue;
      }

      if (parsed.completed === true && !isCompleted) {
        queryCacheRef.current.set(
          key,
          cachedList.filter((t) => t.id !== updatedTask.id),
        );
        continue;
      }

      // 2. The task matches the completion filter of this query (or query does not filter on completed).
      // If this query is a search query:
      // We cannot determine server search membership without running the query on the server.
      // - If the task was already in the search cache: update it in place.
      // - If the task was NOT in the search cache: NEVER insert it! Evict the search cache so
      //   returning to it will fetch fresh authoritative results.
      if (isSearch) {
        const exists = cachedList.some((t) => t.id === updatedTask.id);
        if (exists) {
          queryCacheRef.current.set(
            key,
            cachedList.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
          );
        } else {
          queryCacheRef.current.delete(key);
        }
        continue;
      }

      // 3. If this query has a non-default sort (e.g. oldest),
      // we cannot establish exact insertion position without server sorting.
      // Evict non-default sorted cache entries when a task would need to be newly inserted.
      if (!isDefaultSort) {
        const exists = cachedList.some((t) => t.id === updatedTask.id);
        if (exists) {
          queryCacheRef.current.set(
            key,
            cachedList.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
          );
        } else {
          queryCacheRef.current.delete(key);
        }
        continue;
      }

      // 4. Default sorted view (sort === 'newest' or unset) without search.
      // For active queries: verify list scoping matches.
      if (parsed.completed === false) {
        if (parsed.listId && parsed.listId !== updatedTask.listId) {
          queryCacheRef.current.set(
            key,
            cachedList.filter((t) => t.id !== updatedTask.id),
          );
        } else {
          const nextList = insertOrUpdateNewest(cachedList, updatedTask);
          if (nextList === null) {
            queryCacheRef.current.delete(key);
          } else {
            queryCacheRef.current.set(key, nextList);
          }
        }
        continue;
      }

      // For completed queries: Completed view is global across lists.
      if (parsed.completed === true) {
        const nextList = insertOrUpdateNewest(cachedList, updatedTask);
        if (nextList === null) {
          queryCacheRef.current.delete(key);
        } else {
          queryCacheRef.current.set(key, nextList);
        }
        continue;
      }

      // Query without completed filter (all tasks)
      if (parsed.listId && parsed.listId !== updatedTask.listId) {
        queryCacheRef.current.set(
          key,
          cachedList.filter((t) => t.id !== updatedTask.id),
        );
      } else {
        const nextList = insertOrUpdateNewest(cachedList, updatedTask);
        if (nextList === null) {
          queryCacheRef.current.delete(key);
        } else {
          queryCacheRef.current.set(key, nextList);
        }
      }
    }

    if (displayedQueryKeyRef.current) {
      const updatedForCurrent = queryCacheRef.current.get(
        displayedQueryKeyRef.current,
      );
      if (updatedForCurrent) {
        setTasks(updatedForCurrent);
      }
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updatedTask.id ? { ...t, ...updatedTask } : t,
        ),
      );
    }
  }

  function reconcileTaskCompletion(updatedTask) {
    applyTaskCompletionToCaches(updatedTask);
    refreshTasks();
  }

  function reconcileTaskMove(id, updated) {
    const targetListId = updated.listId;

    for (const [key, cachedList] of queryCacheRef.current.entries()) {
      const parsed = parseQueryKey(key);
      if (!parsed) {
        queryCacheRef.current.delete(key);
        continue;
      }

      if (parsed.listId) {
        if (parsed.listId !== targetListId) {
          // Task was moved out of this list: remove it immediately.
          queryCacheRef.current.set(
            key,
            cachedList.filter((t) => t.id !== id),
          );
        } else {
          // Destination list:
          if (parsed.completed !== undefined && parsed.completed !== updated.completed) {
            queryCacheRef.current.set(
              key,
              cachedList.filter((t) => t.id !== id),
            );
            continue;
          }
          const isSearch = Boolean(parsed.q && String(parsed.q).trim());
          const isDefaultSort = !parsed.sort || parsed.sort === "newest";
          if (isSearch || !isDefaultSort) {
            queryCacheRef.current.delete(key);
          } else {
            const nextList = insertOrUpdateNewest(cachedList, updated);
            if (nextList === null) {
              queryCacheRef.current.delete(key);
            } else {
              queryCacheRef.current.set(key, nextList);
            }
          }
        }
      } else {
        // Global view (like Completed)
        if (parsed.completed !== undefined && parsed.completed !== updated.completed) {
          queryCacheRef.current.set(
            key,
            cachedList.filter((t) => t.id !== id),
          );
          continue;
        }
        const isSearch = Boolean(parsed.q && String(parsed.q).trim());
        const isDefaultSort = !parsed.sort || parsed.sort === "newest";
        if (isSearch || !isDefaultSort) {
          queryCacheRef.current.delete(key);
        } else {
          const nextList = insertOrUpdateNewest(cachedList, updated);
          if (nextList === null) {
            queryCacheRef.current.delete(key);
          } else {
            queryCacheRef.current.set(key, nextList);
          }
        }
      }
    }

    if (displayedQueryKeyRef.current) {
      const updatedForCurrent = queryCacheRef.current.get(
        displayedQueryKeyRef.current,
      );
      if (updatedForCurrent) {
        setTasks(updatedForCurrent);
      }
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      );
    }

    refreshTasks();
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

      for (const [key, cachedList] of queryCacheRef.current.entries()) {
        try {
          const params = Object.fromEntries(JSON.parse(key));
          if (params.listId === id) {
            queryCacheRef.current.delete(key);
          } else if (deleteTasks) {
            queryCacheRef.current.set(
              key,
              cachedList.filter((task) => task.listId !== id),
            );
          } else {
            queryCacheRef.current.set(
              key,
              cachedList.map((task) =>
                task.listId === id ? { ...task, listId: INBOX_LIST_ID } : task,
              ),
            );
          }
        } catch {
          queryCacheRef.current.delete(key);
        }
      }

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

      for (const [key, cachedList] of queryCacheRef.current.entries()) {
        const parsed = parseQueryKey(key);
        if (!parsed) {
          queryCacheRef.current.delete(key);
          continue;
        }
        if (parsed.q) {
          queryCacheRef.current.delete(key);
          continue;
        }
        const isDefaultSort = !parsed.sort || parsed.sort === "newest";
        if (!isDefaultSort) {
          queryCacheRef.current.delete(key);
          continue;
        }
        if (parsed.completed === true) {
          // New task is active, so it does not belong in completed cache
          continue;
        }
        if (parsed.listId && parsed.listId !== listId) {
          // Scoped to a different list
          continue;
        }
        const nextList = insertOrUpdateNewest(cachedList, created);
        if (nextList === null) {
          queryCacheRef.current.delete(key);
        } else {
          queryCacheRef.current.set(key, nextList);
        }
      }

      if (displayedQueryKeyRef.current) {
        const updatedForCurrent = queryCacheRef.current.get(
          displayedQueryKeyRef.current,
        );
        if (updatedForCurrent) {
          setTasks(updatedForCurrent);
        } else {
          setTasks((prev) => {
            const next = insertOrUpdateNewest(prev, created);
            return next !== null ? next : prev;
          });
        }
      } else {
        setTasks((prev) => {
          const next = insertOrUpdateNewest(prev, created);
          return next !== null ? next : prev;
        });
      }

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
      removeTaskFromAllCaches(id);
      refreshTasks();
      return true;
    } catch (cause) {
      setActionError(userMessageFor(cause));
      return false;
    }
  }

  async function toggleTask(id) {
    if (!ready) return refuse("update a task")();

    const ts = taskToggleStateRef.current;
    const currentState = ts.get(id);

    let taskSnapshot = currentState?.taskSnapshot;
    let confirmedTask = currentState?.confirmedTask;

    if (!taskSnapshot) {
      taskSnapshot =
        displayedTasks.find((candidate) => candidate.id === id) ??
        tasksRef.current.find((candidate) => candidate.id === id) ??
        tasks.find((candidate) => candidate.id === id);

      if (!taskSnapshot) {
        for (const list of queryCacheRef.current.values()) {
          const found = list.find((candidate) => candidate.id === id);
          if (found) {
            taskSnapshot = found;
            break;
          }
        }
      }

      if (!taskSnapshot) return false;
      confirmedTask = taskSnapshot;
    }

    const currentCompleted = currentState
      ? currentState.desired
      : taskSnapshot.completed;
    const newDesired = !currentCompleted;
    const optimisticTask = { ...taskSnapshot, completed: newDesired };

    // 1. Immediately apply optimistic cache membership across all warm queries
    applyTaskCompletionToCaches(optimisticTask);

    if (currentState?.inflight) {
      ts.set(id, {
        ...currentState,
        desired: newDesired,
        taskSnapshot: optimisticTask,
      });
      return true;
    }

    const confirmedCompleted =
      currentState?.confirmed ?? confirmedTask?.completed ?? currentCompleted;

    ts.set(id, {
      desired: newDesired,
      confirmed: confirmedCompleted,
      inflight: true,
      confirmedTask,
      taskSnapshot: optimisticTask,
    });

    const loopPromise = (async () => {
      let succeeded = true;
      let lastUpdatedTask = null;

      while (true) {
        const state = ts.get(id);
        if (!state || state.desired === state.confirmed) break;

        const targetCompleted = state.desired;

        try {
          const updated = await tasksApi.update(id, {
            completed: targetCompleted,
          });
          setActionError(null);
          lastUpdatedTask = updated;

          const latest = ts.get(id);
          if (!latest) break;

          ts.set(id, {
            ...latest,
            confirmed: updated.completed,
            confirmedTask: updated,
            taskSnapshot: { ...latest.taskSnapshot, ...updated },
          });

          if (latest.desired === updated.completed) {
            applyTaskCompletionToCaches(updated);
          }
        } catch (cause) {
          const latest = ts.get(id);
          const restoreCompleted = latest?.confirmed ?? confirmedCompleted;
          const restoreTask = latest?.confirmedTask ?? confirmedTask;
          const restoredTask = {
            ...restoreTask,
            completed: restoreCompleted,
          };

          applyTaskCompletionToCaches(restoredTask);
          setActionError(userMessageFor(cause));
          ts.delete(id);
          succeeded = false;
          refreshTasks();
          break;
        }

        const latest = ts.get(id);
        if (!latest || latest.desired === latest.confirmed) break;
      }

      const finalState = ts.get(id);
      if (finalState) {
        if (finalState.desired === finalState.confirmed) {
          ts.delete(id);
        } else {
          ts.set(id, { ...finalState, inflight: false });
        }
      }

      if (succeeded && lastUpdatedTask) {
        applyTaskCompletionToCaches(lastUpdatedTask);
        refreshTasks();
      }

      return succeeded;
    })();

    taskTogglePromisesRef.current.set(id, loopPromise);
    try {
      return await loopPromise;
    } finally {
      if (taskTogglePromisesRef.current.get(id) === loopPromise) {
        taskTogglePromisesRef.current.delete(id);
      }
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
      if (body.completed !== undefined) {
        reconcileTaskCompletion(updated);
      } else if (body.listId !== undefined) {
        reconcileTaskMove(id, updated);
      } else {
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? updated : task)),
        );
        if (body.title !== undefined || body.description !== undefined) {
          for (const [key] of queryCacheRef.current.entries()) {
            const parsed = parseQueryKey(key);
            if (parsed?.q) {
              queryCacheRef.current.delete(key);
            }
          }
        }
        updateTaskInAllCaches(id, (task) => ({ ...task, ...updated }));
        refreshTasks();
      }
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
      updateTaskInAllCaches(taskId, (t) => ({
        ...t,
        checklist: [...(t.checklist ?? []), created],
      }));
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
        updateTaskInAllCaches(taskId, (t) => ({
          ...t,
          checklist: (t.checklist ?? []).map((item) =>
            item.id === itemId
              ? { ...updated, completed: item.completed }
              : item,
          ),
        }));
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
    updateTaskInAllCaches(taskId, (t) => ({
      ...t,
      checklist: (t.checklist ?? []).map((c) =>
        c.id === itemId ? { ...c, completed: newDesired } : c,
      ),
    }));

    if (currentState?.inflight) {
      // A request is already running — update desired intent and let the
      // inflight request's finally-block handle the follow-up.
      ts.set(itemKey, { ...currentState, desired: newDesired });
      return true;
    }

    // No inflight request: determine confirmed baseline.
    const task =
      displayedTasks.find((candidate) => candidate.id === taskId) ??
      tasksRef.current.find((candidate) => candidate.id === taskId);
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
          updateTaskInAllCaches(taskId, (t) => ({
            ...t,
            checklist: (t.checklist ?? []).map((c) =>
              c.id === itemId ? { ...c, completed: restoreCompleted } : c,
            ),
          }));
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
      updateTaskInAllCaches(taskId, (t) => ({
        ...t,
        checklist: (t.checklist ?? []).filter((item) => item.id !== itemId),
      }));
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
    // toggleTask is NOT wrapped with the global guard — it has its own per-task
    // serialized state machine that handles rapid clicks correctly.
    toggleTask,
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
