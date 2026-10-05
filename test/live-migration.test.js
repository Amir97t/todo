import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lists as listsApi, tasks as tasksApi } from "../src/lib/api.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { readMigrationRecord, runMigration } from "../src/lib/migration.js";

const BASE_URL = "http://localhost:3000";

// A realistic round trip against the real backend. Skipped entirely when it
// is not running so `npm test` stays usable without a server.
const backend = await (async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
})();

const marker = `live-migration-${Date.now().toString(36)}`;
const legacyListId = `legacy-${marker}`;

function seedLegacy() {
  localStorage.setItem(
    "todo-app-lists",
    JSON.stringify([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: legacyListId, name: marker, icon: "briefcase" },
    ]),
  );
  localStorage.setItem(
    "todo-app-tasks",
    JSON.stringify([
      {
        id: `legacy-task-${marker}`,
        title: "Live migration task",
        description: "kept",
        completed: false,
        listId: legacyListId,
        createdAt: 1700000000000,
        checklist: [
          { id: "c1", text: "open step", completed: false },
          { id: "c2", text: "done step", completed: true },
        ],
      },
    ]),
  );
  localStorage.setItem("todo-app-selected-list", JSON.stringify("inbox"));
}

describe.runIf(backend)("live migration against the running backend", () => {
  const createdListIds = [];
  const createdTaskIds = [];

  beforeAll(async () => {
    // Never migrate over data this migration did not create.
    const existing = await listsApi.get();
    const foreign = existing.filter((list) => list.id !== INBOX_LIST_ID);
    if (foreign.length > 0) {
      throw new Error(
        `Backend already holds ${foreign.length} non-Inbox list(s); refusing to run a live migration test over unknown data.`,
      );
    }
  });

  afterAll(async () => {
    for (const id of createdTaskIds) {
      try {
        await tasksApi.remove(id);
      } catch {
        /* already gone */
      }
    }
    for (const id of createdListIds) {
      try {
        await listsApi.remove(id, { strategy: "delete" });
      } catch {
        /* already gone */
      }
    }
    localStorage.clear();
  });

  it("migrates legacy rows and cleans up after itself", async () => {
    seedLegacy();

    const listsBefore = await listsApi.get();

    const result = await runMigration();
    expect(result.record.status).toBe("done");

    const listsAfter = await listsApi.get();

    const created = listsAfter.find((list) => list.name === marker);
    expect(created).toBeTruthy();
    createdListIds.push(created.id);

    const record = readMigrationRecord();
    expect(record.listIdMap[legacyListId]).toBe(created.id);
    expect(record.listIdMap.inbox).toBe(INBOX_LIST_ID);
    expect(record.migratedTaskIds).toEqual([`legacy-task-${marker}`]);

    // Inbox was never posted; the count of lists grew by exactly one.
    expect(listsAfter).toHaveLength(listsBefore.length + 1);
    expect(
      listsAfter.filter((list) => list.name === "Inbox"),
    ).toHaveLength(1);

    const migrated = (await tasksApi.get()).find(
      (task) => task.title === "Live migration task",
    );
    expect(migrated).toBeTruthy();
    createdTaskIds.push(migrated.id);

    expect(migrated.listId).toBe(created.id);
    expect(migrated.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(migrated.description).toBe("kept");
    expect(migrated.checklist.map((item) => item.text)).toEqual([
      "open step",
      "done step",
    ]);
    expect(migrated.checklist.map((item) => item.position)).toEqual([0, 1]);
    expect(migrated.checklist.map((item) => item.completed)).toEqual([
      false,
      true,
    ]);

    // Kept in the same test: the shared setup clears localStorage between
    // tests, so a second call here would look like a brand new migration.
    const listsBeforeSecondRun = await listsApi.get();
    const second = await runMigration();

    expect(second.skipped).toBe(true);
    expect(await listsApi.get()).toHaveLength(listsBeforeSecondRun.length);
  });
});
