import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import {
  MigrationConflictError,
  readMigrationRecord,
  runMigration,
} from "../src/lib/migration.js";
import { db, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

const INBOX_ROW = {
  id: INBOX_LIST_ID,
  name: "Inbox",
  icon: "inbox",
  createdAt: "2026-10-04T09:47:20.000Z",
  updatedAt: "2026-10-04T09:47:20.000Z",
};

const FOREIGN_LIST = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Someone else's",
  icon: "folder",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const FOREIGN_TASK = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Not ours",
  description: "",
  completed: false,
  listId: FOREIGN_LIST.id,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  checklist: [],
};

function seedLegacyLists(rows) {
  localStorage.setItem("todo-app-lists", JSON.stringify(rows));
}

function seedLegacyTasks(rows) {
  localStorage.setItem("todo-app-tasks", JSON.stringify(rows));
}

async function bootReady() {
  const utils = renderHook(() => useAppData());
  await waitFor(() => expect(utils.result.current.status).toBe("ready"));
  return utils;
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

describe("State A — fresh browser, nothing to migrate", () => {
  it("loads server data when the server already holds lists and tasks", async () => {
    reset({
      lists: [INBOX_ROW, FOREIGN_LIST],
      tasks: [FOREIGN_TASK],
    });

    const { result } = await bootReady();

    expect(result.current.error).toBeNull();
    expect(result.current.lists.map((list) => list.name)).toContain(
      "Someone else's",
    );
    // Nothing was migrated, so no record should be invented.
    expect(readMigrationRecord()).toBeNull();

    // Pages publish the query; a bare hook has not, so ask for one and the
    // server should answer with its own rows.
    result.current.setTaskQuery({ sort: "newest" });
    await waitFor(() =>
      expect(result.current.tasks.map((task) => task.title)).toEqual([
        "Not ours",
      ]),
    );
  });

  it("loads normally when the server holds only the Inbox", async () => {
    reset();

    const { result } = await bootReady();

    expect(result.current.error).toBeNull();
    expect(result.current.lists.map((list) => list.id)).toEqual([
      INBOX_LIST_ID,
    ]);
    expect(readMigrationRecord()).toBeNull();
  });

  it("ignores a legacy Inbox sentinel with nothing else to migrate", async () => {
    reset({ lists: [INBOX_ROW, FOREIGN_LIST], tasks: [] });
    seedLegacyLists([{ id: "inbox", name: "Inbox", icon: "inbox" }]);
    seedLegacyTasks([]);

    const { result } = await bootReady();

    expect(result.current.error).toBeNull();
    expect(result.current.lists.map((list) => list.name)).toContain(
      "Someone else's",
    );
    expect(readMigrationRecord()).toBeNull();
  });
});

describe("State B — legacy data still needs migrating", () => {
  it("still refuses to merge unknown server data", async () => {
    reset({ lists: [INBOX_ROW, FOREIGN_LIST], tasks: [] });
    seedLegacyLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "legacy-a", name: "Alpha", icon: "briefcase" },
    ]);

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationConflictError);
    expect(readMigrationRecord()).toBeNull();
    // Refusal must not have written, merged or renamed anything.
    expect(db.lists.map((list) => list.name)).toEqual(["Inbox", "Someone else's"]);
  });

  it("reports the conflict to the UI instead of loading silently", async () => {
    reset({ lists: [INBOX_ROW, FOREIGN_LIST], tasks: [] });
    seedLegacyLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "legacy-a", name: "Alpha", icon: "briefcase" },
    ]);

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("already contains");
    expect(readMigrationRecord()).toBeNull();
  });
});

describe("State D — resumable migration", () => {
  it("resumes from recorded progress without re-creating known lists", async () => {
    reset({
      lists: [INBOX_ROW, { ...FOREIGN_LIST, id: "33333333-3333-4333-8333-333333333333", name: "Alpha" }],
      tasks: [],
    });
    seedLegacyLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "legacy-a", name: "Alpha", icon: "briefcase" },
      { id: "legacy-b", name: "Beta", icon: "folder" },
    ]);
    localStorage.setItem(
      "todo-app-migration",
      JSON.stringify({
        version: 1,
        status: "running",
        listIdMap: {
          inbox: INBOX_LIST_ID,
          "legacy-a": "33333333-3333-4333-8333-333333333333",
        },
        migratedTaskIds: [],
      }),
    );

    const result = await runMigration();

    expect(result.record.status).toBe("done");
    expect(result.record.listIdMap["legacy-a"]).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
    expect(result.record.listIdMap["legacy-b"]).toBeTruthy();
    expect(db.lists.filter((list) => list.name === "Alpha")).toHaveLength(1);
  });
});

describe("State C — migration already done", () => {
  it("hydrates from the API without migrating again", async () => {
    reset({ lists: [INBOX_ROW, FOREIGN_LIST], tasks: [FOREIGN_TASK] });
    localStorage.setItem(
      "todo-app-migration",
      JSON.stringify({
        version: 1,
        status: "done",
        listIdMap: {},
        migratedTaskIds: [],
      }),
    );
    seedLegacyLists([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "legacy-a", name: "Alpha", icon: "briefcase" },
    ]);

    const { result } = await bootReady();

    expect(result.current.error).toBeNull();
    expect(result.current.lists.map((list) => list.name)).toContain(
      "Someone else's",
    );
    expect(result.current.lists.map((list) => list.name)).not.toContain("Alpha");
    expect(readMigrationRecord().status).toBe("done");
  });
});
