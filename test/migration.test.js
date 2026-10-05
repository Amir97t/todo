import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MigrationConflictError,
  MigrationError,
  readMigrationRecord,
  runMigration,
} from "../src/lib/migration.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { calls, db, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

const LISTS_KEY = "todo-app-lists";
const TASKS_KEY = "todo-app-tasks";

function seedLists(rows) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(rows));
}

function seedTasks(rows) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(rows));
}

const record = () => readMigrationRecord();

function listRow(overrides = {}) {
  return { id: "l1", name: "Work", icon: "briefcase", ...overrides };
}

function taskRow(overrides = {}) {
  return {
    id: "t1",
    title: "Ship it",
    description: "",
    completed: false,
    listId: "l1",
    createdAt: 1700000000000,
    checklist: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

describe("list migration", () => {
  it("maps the legacy Inbox to the fixed UUID without posting it", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow(),
    ]);

    await runMigration();

    expect(record().listIdMap.inbox).toBe(INBOX_LIST_ID);
    // The server Inbox already existed, so nothing new was created for it.
    expect(
      db.lists.filter((list) => list.name === "Inbox"),
    ).toHaveLength(1);
    expect(calls.filter((call) => call === "lists.create")).toHaveLength(1);
  });

  it("maps custom list ids to the returned server uuid", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
      listRow({ id: "legacy-b", name: "Beta", icon: null }),
    ]);

    await runMigration();

    const map = record().listIdMap;
    expect(map.inbox).toBe(INBOX_LIST_ID);
    expect(map["legacy-a"]).not.toBe("legacy-a");
    expect(map["legacy-b"]).not.toBe("legacy-b");

    const alpha = db.lists.find((list) => list.name === "Alpha");
    const beta = db.lists.find((list) => list.name === "Beta");
    expect(alpha.id).toBe(map["legacy-a"]);
    expect(beta.id).toBe(map["legacy-b"]);
    expect(beta.icon).toBeNull();
  });

  it("never sends the legacy client-generated id", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
    ]);

    await runMigration();

    expect(db.lists.some((list) => list.id === "legacy-a")).toBe(false);
  });

  it("migrates lists before tasks", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
    ]);
    seedTasks([taskRow({ listId: "legacy-a" })]);

    await runMigration();

    expect(calls.indexOf("lists.create")).toBeLessThan(
      calls.indexOf("tasks.create"),
    );
  });

  it("fails on a malformed list instead of inventing defaults", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "broken", name: 42 },
    ]);

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationError);
    expect(record()?.status).not.toBe("done");
  });
});

describe("task migration", () => {
  async function migrateTask(task) {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
    ]);
    seedTasks([task]);
    await runMigration();
    return db.tasks[0];
  }

  it("preserves createdAt as an ISO string", async () => {
    const migrated = await migrateTask(
      taskRow({ listId: "legacy-a", createdAt: 1700000000000 }),
    );

    expect(migrated.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(record().migratedTaskIds).toEqual(["t1"]);
  });

  it("preserves checklist text and order", async () => {
    const migrated = await migrateTask(
      taskRow({
        listId: "legacy-a",
        checklist: [
          { id: "c1", text: "First", completed: false },
          { id: "c2", text: "Second", completed: false },
          { id: "c3", text: "Third", completed: false },
        ],
      }),
    );

    expect(migrated.checklist.map((item) => item.text)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(migrated.checklist.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("preserves completed checklist items through explicit patches", async () => {
    const migrated = await migrateTask(
      taskRow({
        listId: "legacy-a",
        checklist: [
          { id: "c1", text: "Open", completed: false },
          { id: "c2", text: "Done", completed: true },
          { id: "c3", text: "Open too", completed: false },
        ],
      }),
    );

    expect(migrated.checklist.map((item) => item.completed)).toEqual([
      false,
      true,
      false,
    ]);
    expect(calls.filter((call) => call === "checklist.update")).toHaveLength(1);
  });

  it("never sends legacy task or checklist ids", async () => {
    const migrated = await migrateTask(
      taskRow({
        id: "legacy-task",
        listId: "legacy-a",
        checklist: [{ id: "legacy-item", text: "Only", completed: false }],
      }),
    );

    expect(migrated.id).not.toBe("legacy-task");
    expect(migrated.checklist[0].id).not.toBe("legacy-item");
  });

  it("routes Inbox tasks to the fixed Inbox uuid", async () => {
    const migrated = await migrateTask(taskRow({ listId: "inbox" }));

    expect(migrated.listId).toBe(INBOX_LIST_ID);
    expect(record().listIdMap.inbox).toBe(INBOX_LIST_ID);
  });

  it("does not collapse two tasks that share title, createdAt and listId", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
    ]);
    seedTasks([
      taskRow({ id: "t1", listId: "legacy-a", title: "Same", createdAt: 1700000000000 }),
      taskRow({ id: "t2", listId: "legacy-a", title: "Same", createdAt: 1700000000000 }),
    ]);

    await runMigration();

    // Identity is the legacy id, never a content fingerprint.
    expect(db.tasks).toHaveLength(2);
    expect(record().migratedTaskIds).toEqual(["t1", "t2"]);
  });

  it("fails when description is an unexpected non-string shape", async () => {
    await expect(
      migrateTask(
        taskRow({ listId: "legacy-a", description: [{ id: "c1", text: "old" }] }),
      ),
    ).rejects.toBeInstanceOf(MigrationError);
    expect(record()?.status).not.toBe("done");
  });

  it("fails on a malformed task instead of coercing it", async () => {
    await expect(
      migrateTask(taskRow({ listId: "legacy-a", createdAt: "not-a-number" })),
    ).rejects.toBeInstanceOf(MigrationError);
    expect(record()?.status).not.toBe("done");
  });

  it("fails on malformed checklist data", async () => {
    await expect(
      migrateTask(
        taskRow({
          listId: "legacy-a",
          checklist: [{ id: "c1", text: "ok", completed: "yes" }],
        }),
      ),
    ).rejects.toBeInstanceOf(MigrationError);
    expect(record()?.status).not.toBe("done");
  });

  it("fails when a task references a list with no mapping", async () => {
    seedLists([{ id: "inbox", name: "Inbox", icon: "inbox" }]);
    seedTasks([taskRow({ listId: "ghost" })]);

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationError);
    expect(record()?.status).not.toBe("done");
  });
});

describe("migration record lifecycle", () => {
  it("does not run again once completed", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow(),
    ]);

    await runMigration();
    const firstRecord = record();
    expect(firstRecord.status).toBe("done");

    const before = db.lists.length;
    await runMigration();

    expect(db.lists).toHaveLength(before);
    expect(record()).toEqual(firstRecord);
  });

  it("leaves legacy keys byte-identical", async () => {
    const listRows = [
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow(),
    ];
    const taskRows = [taskRow()];
    seedLists(listRows);
    seedTasks(taskRows);
    const listsBefore = localStorage.getItem(LISTS_KEY);
    const tasksBefore = localStorage.getItem(TASKS_KEY);

    await runMigration();

    expect(localStorage.getItem(LISTS_KEY)).toBe(listsBefore);
    expect(localStorage.getItem(TASKS_KEY)).toBe(tasksBefore);
  });

  it("stays not-done when an operation fails", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ name: "" }),
    ]);

    await expect(runMigration()).rejects.toThrow();
    expect(record()?.status).not.toBe("done");
  });

  it("resumes from persisted progress after a partial run", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
      listRow({ id: "legacy-b", name: "Beta" }),
    ]);

    const { fakeApi } = await import("./fakeApi.js");
    const originalCreate = fakeApi.lists.create;
    let failedOnce = false;

    fakeApi.lists.create = async (body) => {
      if (!failedOnce && body.name === "Beta") {
        failedOnce = true;
        throw new Error("boom");
      }
      return originalCreate(body);
    };

    try {
      await expect(runMigration()).rejects.toThrow("boom");

      expect(record().status).not.toBe("done");
      expect(record().listIdMap["legacy-a"]).toBeTruthy();
      expect(record().listIdMap["legacy-b"]).toBeUndefined();
      expect(db.lists.some((list) => list.name === "Beta")).toBe(false);

      // Second run resumes: Alpha is already mapped, so it is not recreated.
      const alphaId = record().listIdMap["legacy-a"];
      await runMigration();

      expect(record().status).toBe("done");
      expect(record().listIdMap["legacy-a"]).toBe(alphaId);
      expect(record().listIdMap["legacy-b"]).toBeTruthy();
      expect(db.lists.filter((list) => list.name === "Alpha")).toHaveLength(1);
      expect(db.lists.filter((list) => list.name === "Beta")).toHaveLength(1);
    } finally {
      fakeApi.lists.create = originalCreate;
    }
  });

  it("marks a fresh install done without migrating anything", async () => {
    await runMigration();

    expect(record().status).toBe("done");
    expect(db.lists).toHaveLength(1);
    expect(db.tasks).toHaveLength(0);
  });
});

describe("server conflict detection", () => {
  it("refuses to touch unknown pre-existing server data", async () => {
    reset({
      lists: [
        {
          id: INBOX_LIST_ID,
          name: "Inbox",
          icon: "inbox",
          createdAt: "",
          updatedAt: "",
        },
        { id: "foreign", name: "Someone else's", icon: null, createdAt: "", updatedAt: "" },
      ],
      tasks: [
        {
          id: "foreign-task",
          title: "Not ours",
          description: "",
          completed: false,
          listId: INBOX_LIST_ID,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          checklist: [],
        },
      ],
    });
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow(),
    ]);

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationConflictError);
    expect(record()).toBeNull();
    // Nothing was written, merged or overwritten.
    expect(db.lists.some((list) => list.name === "Work")).toBe(false);
  });

  it("resumes a known partial migration safely", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
      listRow({ id: "legacy-b", name: "Beta" }),
    ]);

    // Simulate a prior partial run that created Alpha only.
    localStorage.setItem(
      "todo-app-migration",
      JSON.stringify({
        version: 1,
        status: "running",
        listIdMap: { inbox: INBOX_LIST_ID },
        migratedTaskIds: [],
      }),
    );
    reset({
      lists: [
        { id: INBOX_LIST_ID, name: "Inbox", icon: "inbox", createdAt: "", updatedAt: "" },
        { id: "server-alpha", name: "Alpha", icon: null, createdAt: "", updatedAt: "" },
      ],
      tasks: [],
    });

    await runMigration();

    expect(record().status).toBe("done");
    expect(record().listIdMap["legacy-a"]).toBe("server-alpha");
    expect(record().listIdMap["legacy-b"]).toBeTruthy();
    expect(db.lists.filter((list) => list.name === "Alpha")).toHaveLength(1);
    expect(db.lists.filter((list) => list.name === "Beta")).toHaveLength(1);
  });

  it("rejects an unclaimed server list on resume", async () => {
    seedLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      listRow({ id: "legacy-a", name: "Alpha" }),
    ]);
    localStorage.setItem(
      "todo-app-migration",
      JSON.stringify({
        version: 1,
        status: "running",
        listIdMap: { inbox: INBOX_LIST_ID },
        migratedTaskIds: [],
      }),
    );
    reset({
      lists: [
        { id: INBOX_LIST_ID, name: "Inbox", icon: "inbox", createdAt: "", updatedAt: "" },
        { id: "stranger", name: "Unrelated", icon: null, createdAt: "", updatedAt: "" },
      ],
    });

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationConflictError);
  });
});
