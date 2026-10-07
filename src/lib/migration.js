import { lists as listsApi, tasks as tasksApi, checklist as checklistApi } from "./api.js";
import { INBOX_LIST_ID } from "./constants.js";

export const MIGRATION_VERSION = 1;

const MIGRATION_KEY = "todo-app-migration";
const LEGACY_LISTS_KEY = "todo-app-lists";
const LEGACY_TASKS_KEY = "todo-app-tasks";
// Exclusive across every tab of this origin, unlike module state below.
const MIGRATION_LOCK_NAME = "todo-app-migration";

// Level 1: one in-flight migration per JS runtime. StrictMode invokes the
// mounting effect twice, and both callers must share a single pipeline rather
// than each migrating the same legacy rows.
let inFlight = null;

function webLocks() {
  const locks = globalThis.navigator && globalThis.navigator.locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

/**
 * Runs the migration once per runtime, and at most once across tabs.
 *
 * Level 2 is mandatory rather than best-effort: two tabs do not share module
 * memory, so without a cross-tab lock the duplicate-row race this guards
 * against returns. Failing loudly is safe — nothing is written — whereas
 * proceeding unlocked would silently corrupt the user's data.
 */
export function runMigration() {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const locks = webLocks();

    if (!locks) {
      throw new MigrationError(
        [
          "This environment cannot lock migration across browser tabs",
          "(navigator.locks is unavailable).",
          "Close any other tabs of this app and reload to migrate.",
        ].join(" "),
      );
    }

    return locks.request(MIGRATION_LOCK_NAME, () => runMigrationPipeline());
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export class MigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationError";
    this.code = "MIGRATION_FAILED";
  }
}

export class MigrationConflictError extends MigrationError {
  constructor(message) {
    super(message);
    this.name = "MigrationConflictError";
    this.code = "MIGRATION_CONFLICT";
  }
}

function readJson(key, { required = false } = {}) {
  const raw = localStorage.getItem(key);

  if (raw === null) {
    if (required) {
      throw new MigrationError(`Stored data for "${key}" is missing.`);
    }
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new MigrationError(`Stored data for "${key}" is not valid JSON.`);
  }
}

export function readMigrationRecord() {
  return readJson(MIGRATION_KEY);
}

function writeRecord(record) {
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(record));
}

function fail(message) {
  throw new MigrationError(message);
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not an object.`);
  }
}

function validateList(row, index) {
  const label = `Legacy list at index ${index}`;

  assertObject(row, label);

  if (typeof row.id !== "string" || row.id === "") {
    fail(`${label} has no usable id.`);
  }
  if (typeof row.name !== "string") {
    fail(`${label} has a non-string name.`);
  }
  if (row.name.trim() === "") {
    fail(`${label} has an empty name.`);
  }
  if (row.icon !== undefined && row.icon !== null && typeof row.icon !== "string") {
    fail(`${label} has a non-string icon.`);
  }

  return {
    id: row.id,
    name: row.name.trim(),
    icon: typeof row.icon === "string" && row.icon !== "" ? row.icon : null,
  };
}

function validateChecklist(value, label) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    fail(`${label} has a non-array checklist.`);
  }

  return value.map((item, position) => {
    const itemLabel = `${label} checklist item ${position}`;

    assertObject(item, itemLabel);

    if (typeof item.text !== "string") {
      fail(`${itemLabel} has a non-string text.`);
    }
    if (item.text.trim() === "") {
      fail(`${itemLabel} has empty text.`);
    }
    if (typeof item.completed !== "boolean") {
      fail(`${itemLabel} has a non-boolean completed flag.`);
    }

    return { text: item.text.trim(), completed: item.completed };
  });
}

function validateTask(row, index) {
  const label = `Legacy task at index ${index}`;

  assertObject(row, label);

  if (typeof row.id !== "string" || row.id === "") {
    fail(`${label} has no usable id.`);
  }
  if (typeof row.title !== "string" || row.title.trim() === "") {
    fail(`${label} has an empty title.`);
  }
  if (typeof row.listId !== "string" || row.listId === "") {
    fail(`${label} has no listId.`);
  }
  if (typeof row.completed !== "boolean") {
    fail(`${label} has a non-boolean completed flag.`);
  }
  if (
    row.description !== undefined &&
    row.description !== null &&
    typeof row.description !== "string"
  ) {
    fail(
      `${label} has a description that is neither a string nor null/undefined (received ${typeof row.description}).`,
    );
  }
  if (typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt)) {
    fail(`${label} has a non-numeric createdAt.`);
  }

  const description =
    row.description === undefined || row.description === null
      ? null
      : row.description;

  const createdAt = new Date(row.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    fail(`${label} has an unparseable createdAt.`);
  }

  return {
    id: row.id,
    title: row.title.trim(),
    listId: row.listId,
    completed: row.completed,
    description,
    createdAtIso: createdAt.toISOString(),
    checklist: validateChecklist(row.checklist, label),
  };
}

function resolveListTarget(legacyListId, listIdMap) {
  if (legacyListId === "inbox") return INBOX_LIST_ID;
  if (listIdMap[legacyListId]) return listIdMap[legacyListId];
  return null;
}

/**
 * Server data we cannot account for is a conflict — never merged, never
 * overwritten. On a first run nothing of ours is on the server, so any
 * non-Inbox data is foreign. On a resume the recorded progress explains
 * exactly which lists belong to us.
 */
async function assertNoConflict(serverLists, serverTasks, existingRecord) {
  if (existingRecord === null) {
    const foreignLists = serverLists.filter((list) => list.id !== INBOX_LIST_ID);
    if (foreignLists.length > 0) {
      throw new MigrationConflictError(
        `The server already contains ${foreignLists.length} list(s) that this migration did not create (${foreignLists
          .map((list) => `"${list.name}"`)
          .join(", ")}). Merging would risk overwriting them.`,
      );
    }
    if (serverTasks.length > 0) {
      throw new MigrationConflictError(
        `The server already contains ${serverTasks.length} task(s) that this migration did not create.`,
      );
    }
    return;
  }

  const claimed = new Set([
    ...Object.values(existingRecord.listIdMap ?? {}),
    INBOX_LIST_ID,
  ]);
  const unclaimed = serverLists.filter((list) => !claimed.has(list.id));

  // Unclaimed lists are only acceptable when they can be adopted below as
  // crash-window leftovers; anything else is reported after adoption.
  const recorded = existingRecord.migratedTaskIds ?? [];
  if (serverTasks.length < recorded.length) {
    throw new MigrationConflictError(
      `The server holds ${serverTasks.length} task(s) but ${recorded.length} were recorded as migrated. Data may have been removed outside this app.`,
    );
  }

  return unclaimed;
}

async function runMigrationPipeline() {
  const existing = readMigrationRecord();

  if (existing && existing.status === "done") {
    return { skipped: true };
  }

  const rawLists = readJson(LEGACY_LISTS_KEY);
  const rawTasks = readJson(LEGACY_TASKS_KEY);

  if (rawLists !== null && !Array.isArray(rawLists)) {
    fail(`Stored "${LEGACY_LISTS_KEY}" is not an array.`);
  }
  if (rawTasks !== null && !Array.isArray(rawTasks)) {
    fail(`Stored "${LEGACY_TASKS_KEY}" is not an array.`);
  }

  const legacyLists = rawLists ?? [];
  const legacyTasks = rawTasks ?? [];
  const hasLegacyData = rawLists !== null || rawTasks !== null;

  // State A: no record and no row that actually needs migrating (the legacy
  // Inbox sentinel maps onto the row the backend already seeds). There would
  // be nothing to write, so there is nothing for conflict detection to
  // protect — running it here would refuse to load a fresh browser against a
  // populated server. Malformed legacy data still failed above, and any row
  // that does need migrating falls through to the conflict check below.
  const migratableLists = legacyLists.filter((list) => list.id !== "inbox");
  if (
    !existing &&
    migratableLists.length === 0 &&
    legacyTasks.length === 0
  ) {
    return { skipped: true };
  }

  const serverLists = await listsApi.get();
  const serverTasks = await tasksApi.get();

  const unclaimed = await assertNoConflict(serverLists, serverTasks, existing);

  const record = existing ?? {
    version: MIGRATION_VERSION,
    status: "running",
    listIdMap: {},
    migratedTaskIds: [],
  };

  if (existing === null) {
    writeRecord({ ...record, status: "running" });
  }

  if (!hasLegacyData) {
    const done = { ...record, status: "done" };
    writeRecord(done);
    return { fresh: true, record: done };
  }

  // ---- Phase 1: validate everything before writing anything ----
  const validatedLists = legacyLists.map(validateList);
  const validatedTasks = legacyTasks.map(validateTask);

  const listIdMap = { ...(record.listIdMap ?? {}) };
  const migratedTaskIds = [...(record.migratedTaskIds ?? [])];

  for (const list of validatedLists) {
    if (list.id === "inbox" && !listIdMap["inbox"]) {
      listIdMap["inbox"] = INBOX_LIST_ID;
    }
  }

  // ---- Phase 2: lists, in legacy order ----
  const adopted = new Set();

  for (const list of validatedLists) {
    if (list.id === "inbox") continue;
    if (listIdMap[list.id]) continue;

    if (existing !== null) {
      // Only records this migration already owns may be adopted, and only
      // when the match is unambiguous.
      const candidates = (unclaimed ?? []).filter(
        (server) =>
          !adopted.has(server.id) &&
          server.name.toLowerCase() === list.name.toLowerCase(),
      );

      if (candidates.length === 1) {
        listIdMap[list.id] = candidates[0].id;
        adopted.add(candidates[0].id);
        writeRecord({ ...record, status: "running", listIdMap, migratedTaskIds });
        continue;
      }
      if (candidates.length > 1) {
        throw new MigrationConflictError(
          `Server list "${list.name}" matches more than one unclaimed list; cannot tell which one this migration created.`,
        );
      }
      if ((unclaimed ?? []).some((server) => !adopted.has(server.id))) {
        const leftover = (unclaimed ?? []).find((server) => !adopted.has(server.id));
        throw new MigrationConflictError(
          `The server contains list "${leftover.name}" that is not recorded as migrated.`,
        );
      }
    }

    const created = await listsApi.create(
      list.icon ? { name: list.name, icon: list.icon } : { name: list.name },
    );

    listIdMap[list.id] = created.id;
    writeRecord({ ...record, status: "running", listIdMap, migratedTaskIds });
  }

  // Any still-unclaimed server list after adoption is unknown data.
  for (const server of unclaimed ?? []) {
    if (!adopted.has(server.id) && !Object.values(listIdMap).includes(server.id)) {
      throw new MigrationConflictError(
        `The server contains list "${server.name}" that is not recorded as migrated.`,
      );
    }
  }

  // ---- Phase 3: tasks ----
  const createdThisRun = [];

  for (const task of validatedTasks) {
    if (migratedTaskIds.includes(task.id)) continue;

    const targetListId = resolveListTarget(task.listId, listIdMap);
    if (!targetListId) {
      fail(
        `Legacy task "${task.title}" references list "${task.listId}", which has no migration mapping.`,
      );
    }

    const payload = {
      title: task.title,
      completed: task.completed,
      listId: targetListId,
      createdAt: task.createdAtIso,
      checklist: task.checklist.map((item) => ({ text: item.text })),
    };

    if (task.description !== null) {
      payload.description = task.description;
    }

    const created = await tasksApi.create(payload);

    if (created.checklist.length !== task.checklist.length) {
      fail(
        `Legacy task "${task.title}" expected ${task.checklist.length} checklist items but the server returned ${created.checklist.length}.`,
      );
    }

    // The API creates items with completed:false, so completed state is
    // restored positionally — ids are server-generated and never reused.
    for (let i = 0; i < task.checklist.length; i += 1) {
      if (task.checklist[i].completed) {
        await checklistApi.update(created.id, created.checklist[i].id, {
          completed: true,
        });
      }
    }

    migratedTaskIds.push(task.id);
    createdThisRun.push({ legacyId: task.id, serverId: created.id, legacy: task });
    writeRecord({ ...record, status: "running", listIdMap, migratedTaskIds });
  }

  // ---- Phase 4: verify before declaring done ----
  await verifyMigration({
    listIdMap,
    migratedTaskIds,
    validatedLists,
    createdThisRun,
    unclaimed: unclaimed ?? [],
    adopted,
  });

  const done = {
    version: MIGRATION_VERSION,
    status: "done",
    listIdMap,
    migratedTaskIds,
  };
  writeRecord(done);

  return { record: done, createdThisRun };
}

async function verifyMigration({
  listIdMap,
  migratedTaskIds,
  validatedLists,
  createdThisRun,
  unclaimed,
  adopted,
}) {
  const serverLists = await listsApi.get();
  const serverIds = new Set(serverLists.map((list) => list.id));

  for (const legacyId of Object.keys(listIdMap)) {
    if (!serverIds.has(listIdMap[legacyId])) {
      fail(`Migration verification failed: mapped list "${legacyId}" is missing on the server.`);
    }
  }

  const expectedCustom = validatedLists.filter((list) => list.id !== "inbox");
  for (const list of expectedCustom) {
    const mapped = listIdMap[list.id];
    if (!mapped || !serverIds.has(mapped)) {
      fail(`Migration verification failed: legacy list "${list.name}" was not created.`);
    }
  }

  const serverTasks = await tasksApi.get();
  if (serverTasks.length < migratedTaskIds.length) {
    fail(
      `Migration verification failed: expected ${migratedTaskIds.length} migrated task(s) but the server holds ${serverTasks.length}.`,
    );
  }

  const byId = new Map(serverTasks.map((task) => [task.id, task]));

  for (const { serverId, legacy } of createdThisRun) {
    const server = byId.get(serverId);
    if (!server) {
      fail(`Migration verification failed: task "${legacy.title}" is missing on the server.`);
    }
    if (server.title !== legacy.title) {
      fail(`Migration verification failed: task title changed for "${legacy.title}".`);
    }
    if (server.createdAt !== legacy.createdAtIso) {
      fail(`Migration verification failed: createdAt was not preserved for "${legacy.title}".`);
    }

    const expectedListId =
      legacy.listId === "inbox" ? INBOX_LIST_ID : null;
    if (expectedListId && server.listId !== expectedListId) {
      fail(`Migration verification failed: Inbox task "${legacy.title}" is not on the Inbox.`);
    }

    if (server.checklist.length !== legacy.checklist.length) {
      fail(`Migration verification failed: checklist length changed for "${legacy.title}".`);
    }
    for (let i = 0; i < legacy.checklist.length; i += 1) {
      if (server.checklist[i].text !== legacy.checklist[i].text) {
        fail(`Migration verification failed: checklist order changed for "${legacy.title}".`);
      }
      if (server.checklist[i].completed !== legacy.checklist[i].completed) {
        fail(`Migration verification failed: checklist completion changed for "${legacy.title}".`);
      }
    }
  }

  void unclaimed;
  void adopted;
}
