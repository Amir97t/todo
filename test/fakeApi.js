import { INBOX_LIST_ID } from "../src/lib/constants.js";

// In-memory stand-in for the backend, used by vi.mock so the data layer can
// be exercised end to end without a server. State lives at module scope so
// the test file and the mock factory share one instance.

const INBOX_ROW = {
  id: INBOX_LIST_ID,
  name: "Inbox",
  icon: "inbox",
  createdAt: "2026-10-04T09:47:20.000Z",
  updatedAt: "2026-10-04T09:47:20.000Z",
};

let lists = [];
let tasks = [];

/** Call order, so tests can assert sequencing (e.g. lists before tasks). */
export const calls = [];

/** The most recent GET /tasks query, so tests can assert what pages send. */
export const lastTaskQuery = { value: null };

export const db = {
  get lists() {
    return lists;
  },
  get tasks() {
    return tasks;
  },
};

export function reset({ lists: nextLists, tasks: nextTasks } = {}) {
  // Mirrors the real backend, which always has the seeded Inbox row.
  lists = structuredClone(nextLists ?? [INBOX_ROW]);
  tasks = structuredClone(nextTasks ?? []);
  calls.length = 0;
  lastTaskQuery.value = null;
}

function fail(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function notFound(message, code) {
  fail(message, 404, code);
}

function findList(id) {
  const found = lists.find((list) => list.id === id);
  if (!found) notFound("List not found.", "LIST_NOT_FOUND");
  return found;
}

function findTask(id) {
  const found = tasks.find((task) => task.id === id);
  if (!found) notFound("Task not found.", "TASK_NOT_FOUND");
  return found;
}

function checkListName(name, ignoreId) {
  const duplicate = lists.find(
    (list) =>
      list.id !== ignoreId && list.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) fail("A list with that name already exists.", 409, "LIST_NAME_EXISTS");
}

function nextChecklistPosition(taskId) {
  const items = tasks.find((task) => task.id === taskId)?.checklist ?? [];
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

function withChecklist(task) {
  return structuredClone({
    ...task,
    checklist: [...(task.checklist ?? [])].sort((a, b) => a.position - b.position),
  });
}

export const fakeApi = {
  lists: {
    get: async () => structuredClone(lists),

    create: async (body) => {
      calls.push("lists.create");
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) fail("name should not be empty", 400, "VALIDATION_ERROR");
      checkListName(name);

      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        name,
        icon: body?.icon ?? null,
        createdAt: now,
        updatedAt: now,
      };
      lists.push(row);
      return structuredClone(row);
    },

    update: async (id, body) => {
      const row = findList(id);

      if (body?.name !== undefined) {
        const name = body.name.trim();
        if (!name) fail("name should not be empty", 400, "VALIDATION_ERROR");
        checkListName(name, id);
        row.name = name;
      }
      if (body?.icon !== undefined) row.icon = body.icon;
      row.updatedAt = new Date().toISOString();

      return structuredClone(row);
    },

    remove: async (id, options = {}) => {
      findList(id);
      const strategy = options.strategy ?? "relocate";
      let tasksAffected;

      if (strategy === "delete") {
        const doomed = tasks.filter((task) => task.listId === id);
        tasksAffected = doomed.length;
        tasks = tasks.filter((task) => task.listId !== id);
      } else {
        const moving = tasks.filter((task) => task.listId === id);
        tasksAffected = moving.length;
        tasks = tasks.map((task) =>
          task.listId === id ? { ...task, listId: INBOX_LIST_ID } : task,
        );
      }

      lists = lists.filter((list) => list.id !== id);
      return { id, strategy, tasksAffected };
    },
  },

  tasks: {
    get: async (query = {}) => {
      calls.push("tasks.get");
      lastTaskQuery.value = query;
      let rows = structuredClone(tasks);

      if (query.listId) rows = rows.filter((task) => task.listId === query.listId);
      if (query.completed !== undefined) {
        rows = rows.filter((task) => task.completed === query.completed);
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        rows = rows.filter(
          (task) =>
            task.title.toLowerCase().includes(needle) ||
            (task.description ?? "").toLowerCase().includes(needle),
        );
      }

      const direction = query.sort === "oldest" || query.sort === "az" ? 1 : -1;
      rows.sort((a, b) => (a.createdAt < b.createdAt ? direction : -direction));

      return rows.map(withChecklist);
    },

    create: async (body) => {
      calls.push("tasks.create");
      const title = typeof body?.title === "string" ? body.title.trim() : "";
      if (!title) fail("title should not be empty", 400, "VALIDATION_ERROR");
      if (!body?.listId || !lists.some((list) => list.id === body.listId)) {
        notFound("List not found.", "LIST_NOT_FOUND");
      }

      const raw = Array.isArray(body?.checklist) ? body.checklist : [];
      const checklist = raw.map((item, position) => ({
        id: crypto.randomUUID(),
        text: String(item?.text ?? "").trim(),
        completed: false,
        position,
      }));

      const row = {
        id: crypto.randomUUID(),
        title,
        description: body?.description ?? "",
        completed: body?.completed === true,
        listId: body.listId,
        createdAt: body?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checklist,
      };
      tasks.push(row);
      return withChecklist(row);
    },

    update: async (id, body) => {
      const row = findTask(id);

      if (body?.title !== undefined) {
        const title = body.title.trim();
        if (!title) fail("title should not be empty", 400, "VALIDATION_ERROR");
        row.title = title;
      }
      if (body?.description !== undefined) row.description = body.description;
      if (body?.completed !== undefined) row.completed = body.completed;
      if (body?.listId !== undefined) {
        findList(body.listId);
        row.listId = body.listId;
      }
      row.updatedAt = new Date().toISOString();

      return withChecklist(row);
    },

    remove: async (id) => {
      findTask(id);
      tasks = tasks.filter((task) => task.id !== id);
      return { id };
    },
  },

  checklist: {
    create: async (taskId, body) => {
      findTask(taskId);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text) fail("text should not be empty", 400, "VALIDATION_ERROR");

      const item = {
        id: crypto.randomUUID(),
        text,
        completed: false,
        position: nextChecklistPosition(taskId),
      };
      const task = tasks.find((candidate) => candidate.id === taskId);
      task.checklist = [...(task.checklist ?? []), item];
      return structuredClone(item);
    },

    update: async (taskId, itemId, body) => {
      calls.push("checklist.update");
      findTask(taskId);
      const task = tasks.find((candidate) => candidate.id === taskId);
      const item = (task.checklist ?? []).find((c) => c.id === itemId);
      if (!item) notFound("Checklist item not found.", "CHECKLIST_ITEM_NOT_FOUND");

      if (body?.text !== undefined) item.text = body.text.trim();
      if (body?.completed !== undefined) item.completed = body.completed;
      return structuredClone(item);
    },

    remove: async (taskId, itemId) => {
      findTask(taskId);
      const task = tasks.find((candidate) => candidate.id === taskId);
      const item = (task.checklist ?? []).some((c) => c.id === itemId);
      if (!item) notFound("Checklist item not found.", "CHECKLIST_ITEM_NOT_FOUND");

      task.checklist = task.checklist.filter((c) => c.id !== itemId);
      return { id: itemId };
    },
  },
};
