import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { db, fakeApi, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

const LISTS_KEY = "todo-app-lists";
const TASKS_KEY = "todo-app-tasks";

function seedLegacy() {
  localStorage.setItem(
    LISTS_KEY,
    JSON.stringify([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "l1", name: "Work", icon: "briefcase" },
    ]),
  );
  localStorage.setItem(TASKS_KEY, JSON.stringify([]));
  localStorage.setItem(
    "todo-app-selected-list",
    JSON.stringify("inbox"),
  );
}

/** Blocks the first lists.get() so the pre-migration state can be observed. */
function gateMigration() {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const original = fakeApi.lists.get;

  fakeApi.lists.get = async () => {
    await gate;
    return original();
  };

  return {
    open: () => release(),
    restore: () => {
      fakeApi.lists.get = original;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

describe("store switch", () => {
  it("keeps local data on screen until migration completes", async () => {
    seedLegacy();
    const blocker = gateMigration();

    try {
      const { result } = renderHook(() => useAppData());

      // Migration is still in flight: status stays idle and the legacy rows
      // are what the UI would render.
      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
      expect(result.current.lists.map((list) => list.id)).toEqual([
        INBOX_LIST_ID,
        "l1",
      ]);

      // Mutations are refused while the store has not switched, so nothing
      // can be written that the switch would then discard.
      expect(await result.current.addList("New", "folder")).toBe(false);

      blocker.open();
      await waitFor(() => expect(result.current.status).toBe("ready"));
    } finally {
      blocker.restore();
    }
  });

  it("replaces local state with API data once migration finishes", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.lists.map((list) => list.id)).toEqual([
      INBOX_LIST_ID,
      db.lists.find((list) => list.name === "Work").id,
    ]);
    // The stored selection was the legacy "inbox" sentinel.
    expect(result.current.selectedListId).toBe(INBOX_LIST_ID);
  });

  it("updates React state from the API response on mutation", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(await result.current.addList("  Design  ", "plane")).toBe(true);

    await waitFor(() =>
      expect(result.current.lists.some((list) => list.name === "Design")).toBe(
        true,
      ),
    );

    const created = result.current.lists.find((list) => list.name === "Design");
    expect(created.name).toBe("Design");
    // The row is whatever the API returned, not a client-side construction.
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.createdAt).toBeTruthy();
    expect(db.lists.some((list) => list.id === created.id)).toBe(true);
  });

  it("reflects task mutations returned by the API", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const workId = result.current.lists.find((list) => list.name === "Work").id;

    expect(await result.current.taskActions.addTask("Write tests", "", [], workId)).toBe(
      true,
    );
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    const created = result.current.tasks[0];
    expect(created.title).toBe("Write tests");

    // Re-read the action: each render closes over the current task list.
    expect(await result.current.taskActions.toggleTask(created.id)).toBe(true);
    await waitFor(() =>
      expect(result.current.tasks[0].completed).toBe(true),
    );
    expect(db.tasks[0].completed).toBe(true);
  });

  it("never writes the legacy keys after the switch", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const listsBefore = localStorage.getItem(LISTS_KEY);
    const tasksBefore = localStorage.getItem(TASKS_KEY);

    const workId = result.current.lists.find((list) => list.name === "Work").id;
    await result.current.addList("Another", "folder");
    await result.current.taskActions.addTask("Task", "", [], workId);
    await result.current.renameList(workId, "Renamed", "folder");

    expect(localStorage.getItem(LISTS_KEY)).toBe(listsBefore);
    expect(localStorage.getItem(TASKS_KEY)).toBe(tasksBefore);
    expect(JSON.parse(localStorage.getItem(LISTS_KEY))).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(TASKS_KEY))).toHaveLength(0);
  });

  it("reports failure when the API rejects a mutation", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const { addTask } = result.current.taskActions;
    expect(await addTask("Orphan", "", [], "not-a-real-list")).toBe(false);
    await waitFor(() => expect(result.current.actionError).toBeTruthy());
    expect(result.current.tasks).toHaveLength(0);
  });

  it("does not run a completed migration again", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const record = JSON.parse(localStorage.getItem("todo-app-migration"));
    expect(record.status).toBe("done");
    expect(result.current.status).toBe("ready");
  });
});
