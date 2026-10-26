import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { calls, db, fakeApi, lastTaskQuery, reset } from "./fakeApi.js";

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

  it("removes a toggled task from the active query before the API responds", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const workId = result.current.lists.find((list) => list.name === "Work").id;
    expect(
      await result.current.taskActions.addTask("Optimistic toggle", "", [], workId),
    ).toBe(true);
    await waitFor(() =>
      expect(
        result.current.tasks.some((task) => task.title === "Optimistic toggle"),
      ).toBe(true),
    );
    const created = result.current.tasks.find(
      (task) => task.title === "Optimistic toggle",
    );

    act(() => {
      result.current.setTaskQuery({
        listId: workId,
        completed: false,
        sort: "newest",
      });
    });
    await waitFor(() =>
      expect(result.current.tasks.map((task) => task.id)).toEqual([created.id]),
    );

    const readsBeforeToggle = calls.filter((call) => call === "tasks.get").length;
    const originalUpdate = fakeApi.tasks.update;
    let releaseUpdate;
    const updateGate = new Promise((resolve) => {
      releaseUpdate = resolve;
    });
    fakeApi.tasks.update = async (id, body) => {
      await updateGate;
      return originalUpdate(id, body);
    };

    try {
      let togglePromise;
      act(() => {
        togglePromise = result.current.taskActions.toggleTask(created.id);
      });

      // The task leaves Active immediately, while its server write is still
      // deliberately blocked.
      expect(result.current.tasks).toHaveLength(0);
      expect(calls.filter((call) => call === "tasks.get").length).toBe(
        readsBeforeToggle,
      );

      releaseUpdate();
      expect(await togglePromise).toBe(true);
      expect(db.tasks.find((task) => task.id === created.id).completed).toBe(true);
      // A successful toggle must not issue the old redundant follow-up GET.
      expect(calls.filter((call) => call === "tasks.get").length).toBe(
        readsBeforeToggle,
      );
    } finally {
      releaseUpdate?.();
      fakeApi.tasks.update = originalUpdate;
    }
  });

  it("reconciles the destination query when navigating during a pending toggle", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const workId = result.current.lists.find((list) => list.name === "Work").id;
    expect(
      await result.current.taskActions.addTask("Navigate during toggle", "", [], workId),
    ).toBe(true);
    await waitFor(() =>
      expect(
        result.current.tasks.some((task) => task.title === "Navigate during toggle"),
      ).toBe(true),
    );
    const created = result.current.tasks.find(
      (task) => task.title === "Navigate during toggle",
    );

    act(() => {
      result.current.setTaskQuery({
        listId: workId,
        completed: false,
        sort: "newest",
      });
    });
    await waitFor(() => expect(result.current.tasks.map((task) => task.id)).toEqual([created.id]));

    const originalUpdate = fakeApi.tasks.update;
    let releaseUpdate;
    const updateGate = new Promise((resolve) => {
      releaseUpdate = resolve;
    });
    fakeApi.tasks.update = async (id, body) => {
      await updateGate;
      return originalUpdate(id, body);
    };

    try {
      let togglePromise;
      act(() => {
        togglePromise = result.current.taskActions.toggleTask(created.id);
      });
      expect(result.current.tasks).toHaveLength(0);

      // Simulate opening Completed before the PATCH commits. Its first GET
      // correctly returns no row, so success must trigger a reconciliation GET.
      act(() => {
        result.current.setTaskQuery({ completed: true, sort: "newest" });
      });
      await waitFor(() =>
        expect(lastTaskQuery.value).toMatchObject({ completed: true }),
      );
      expect(db.tasks.find((task) => task.id === created.id).completed).toBe(false);

      releaseUpdate();
      expect(await togglePromise).toBe(true);
      await waitFor(() =>
        expect(result.current.tasks.map((task) => task.id)).toEqual([created.id]),
      );
      expect(result.current.tasks[0].completed).toBe(true);
    } finally {
      releaseUpdate?.();
      fakeApi.tasks.update = originalUpdate;
    }
  });

  it("restores a task when its optimistic completion update fails", async () => {
    seedLegacy();

    const { result } = renderHook(() => useAppData());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const workId = result.current.lists.find((list) => list.name === "Work").id;
    expect(
      await result.current.taskActions.addTask("Failed toggle", "", [], workId),
    ).toBe(true);
    await waitFor(() =>
      expect(result.current.tasks.some((task) => task.title === "Failed toggle")).toBe(true),
    );
    const created = result.current.tasks.find((task) => task.title === "Failed toggle");

    act(() => {
      result.current.setTaskQuery({
        listId: workId,
        completed: false,
        sort: "newest",
      });
    });
    await waitFor(() => expect(result.current.tasks.map((task) => task.id)).toEqual([created.id]));

    const originalUpdate = fakeApi.tasks.update;
    fakeApi.tasks.update = async () => {
      throw new Error("Simulated request failure");
    };

    try {
      let togglePromise;
      act(() => {
        togglePromise = result.current.taskActions.toggleTask(created.id);
      });
      expect(result.current.tasks).toHaveLength(0);
      expect(await togglePromise).toBe(false);

      await waitFor(() =>
        expect(result.current.tasks.map((task) => task.id)).toEqual([created.id]),
      );
      expect(result.current.tasks[0].completed).toBe(false);
      expect(result.current.actionError).toBeTruthy();
      expect(db.tasks.find((task) => task.id === created.id).completed).toBe(false);
    } finally {
      fakeApi.tasks.update = originalUpdate;
    }
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

    const record = JSON.parse(localStorage.getItem("todo-app-migration:test-user"));
    expect(record.status).toBe("done");
    expect(result.current.status).toBe("ready");
  });
});


vi.mock("../src/lib/authSession.js", async () => {
  const actual = await vi.importActual("../src/lib/authSession.js");
  return { ...actual, getAccessTokenSubject: () => "test-user" };
});
