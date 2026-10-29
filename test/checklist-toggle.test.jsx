import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { db, fakeApi, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

vi.mock("../src/lib/authSession.js", async () => {
  const actual = await vi.importActual("../src/lib/authSession.js");
  return { ...actual, getAccessTokenSubject: () => "test-user" };
});

async function renderReadyHook() {
  const utils = renderHook(() => useAppData());
  await waitFor(() => expect(utils.result.current.status).toBe("ready"));
  return utils;
}

/** Seed a task with one checklist item so every test starts from the same state. */
async function seedTaskWithChecklistItem(result) {
  await result.current.taskActions.addTask("Test task", "", [], INBOX_LIST_ID);
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));

  const taskId = result.current.tasks[0].id;
  await result.current.taskActions.addChecklistItem(taskId, "Step A");
  await waitFor(() =>
    expect(result.current.tasks[0].checklist).toHaveLength(1),
  );

  const itemId = result.current.tasks[0].checklist[0].id;
  return { taskId, itemId };
}

/** Seed a task with two checklist items. */
async function seedTaskWithTwoItems(result) {
  await result.current.taskActions.addTask("Test task", "", [], INBOX_LIST_ID);
  await waitFor(() => expect(result.current.tasks).toHaveLength(1));

  const taskId = result.current.tasks[0].id;
  await result.current.taskActions.addChecklistItem(taskId, "Step A");
  await result.current.taskActions.addChecklistItem(taskId, "Step B");
  await waitFor(() =>
    expect(result.current.tasks[0].checklist).toHaveLength(2),
  );

  const itemAId = result.current.tasks[0].checklist[0].id;
  const itemBId = result.current.tasks[0].checklist[1].id;
  return { taskId, itemAId, itemBId };
}

/** Create a deferred promise: { promise, resolve, reject }. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Patch fakeApi.checklist.update to gate on a deferred and then resolve. */
function gateUpdate(originalUpdate) {
  const gate = deferred();
  const patched = async (...args) => {
    await gate.promise;
    return originalUpdate(...args);
  };
  return { patched, gate };
}

beforeEach(() => {
  reset();
});

// ─── Part A: Rapid Checklist Toggle Tests ────────────────────────────────────

describe("checklist toggle — optimistic update", () => {
  it("flips the item immediately before the API responds", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    const { patched, gate } = gateUpdate(originalUpdate);
    fakeApi.checklist.update = patched;

    try {
      const togglePromise = result.current.taskActions.toggleChecklistItem(
        taskId,
        itemId,
      );

      // Optimistic flip happens before request settles.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      gate.resolve();
      await togglePromise;

      expect(result.current.tasks[0].checklist[0].completed).toBe(true);
      expect(db.tasks[0].checklist[0].completed).toBe(true);
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("rolls back only the toggled item on API failure", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    fakeApi.checklist.update = async () => {
      const error = new Error("Server error");
      error.status = 500;
      error.code = "SERVER_ERROR";
      throw error;
    };

    try {
      const toggleResult =
        await result.current.taskActions.toggleChecklistItem(taskId, itemId);

      expect(toggleResult).toBe(false);

      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );

      await waitFor(() => expect(result.current.actionError).toBeTruthy());
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("reconciles with the server response on success", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    const toggleResult =
      await result.current.taskActions.toggleChecklistItem(taskId, itemId);

    expect(toggleResult).toBe(true);

    await waitFor(() =>
      expect(result.current.tasks[0].checklist[0].completed).toBe(true),
    );

    expect(db.tasks[0].checklist[0].completed).toBe(true);
  });
});

describe("checklist toggle — rapid clicks (serialized)", () => {
  it("two rapid clicks during a delayed request: UI changes on both, final state is correct", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    // Initial: uncompleted.
    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    const firstGate = deferred();
    let callCount = 0;

    fakeApi.checklist.update = async (tId, iId, body) => {
      callCount++;
      if (callCount === 1) {
        // First request hangs until we release it.
        await firstGate.promise;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // First click: uncompleted → completed.
      const promise1 = result.current.taskActions.toggleChecklistItem(taskId, itemId);
      // UI should show completed immediately.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Second click while first request is still in flight: completed → uncompleted.
      const promise2 = result.current.taskActions.toggleChecklistItem(taskId, itemId);
      // UI should flip back to uncompleted immediately.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );

      // Release the first request.
      firstGate.resolve();
      await promise1;
      await promise2;

      // After both settle: final desired state is uncompleted (two clicks = back to start).
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );
      expect(db.tasks[0].checklist[0].completed).toBe(false);
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("three rapid clicks: final state matches three-click intent (completed)", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    const firstGate = deferred();
    let callCount = 0;

    fakeApi.checklist.update = async (tId, iId, body) => {
      callCount++;
      if (callCount === 1) {
        await firstGate.promise;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // Click 1: false → true.
      const promise1 = result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Click 2: true → false.
      result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );

      // Click 3: false → true.
      result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Release first request.
      firstGate.resolve();
      await promise1;

      // Final: three clicks net = completed.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );
      await waitFor(() =>
        expect(db.tasks[0].checklist[0].completed).toBe(true),
      );
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("a stale response does not overwrite the latest intent", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    const slowGate = deferred();
    let callCount = 0;

    fakeApi.checklist.update = async (tId, iId, body) => {
      callCount++;
      if (callCount === 1) {
        // Simulate a very slow first request.
        await slowGate.promise;
        return originalUpdate(tId, iId, { completed: true });
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // First click: → completed.
      const promise1 = result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Second click: → uncompleted (latest intent).
      result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );

      // Release slow first response now — it must not overwrite the latest intent.
      slowGate.resolve();
      await promise1;

      // Final state is still uncompleted (latest desired = false).
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("failure restores last confirmed state and releases pending state", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    // Pre-confirm: toggle once successfully to set confirmed = true.
    await result.current.taskActions.toggleChecklistItem(taskId, itemId);
    await waitFor(() =>
      expect(result.current.tasks[0].checklist[0].completed).toBe(true),
    );

    // Now make the API fail.
    const originalUpdate = fakeApi.checklist.update;
    fakeApi.checklist.update = async () => {
      const error = new Error("Network error");
      error.status = 500;
      error.code = "SERVER_ERROR";
      throw error;
    };

    try {
      // Toggle again (true → false optimistically), then it fails.
      const toggleResult = await result.current.taskActions.toggleChecklistItem(
        taskId,
        itemId,
      );

      expect(toggleResult).toBe(false);

      // Should be restored to the last confirmed state (true).
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Error should be shown.
      await waitFor(() => expect(result.current.actionError).toBeTruthy());

      // After failure, the item must not be stuck — a new toggle should work.
      fakeApi.checklist.update = originalUpdate;
      const recoveryResult = await result.current.taskActions.toggleChecklistItem(
        taskId,
        itemId,
      );
      expect(recoveryResult).toBe(true);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("independent items can toggle independently without blocking each other", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemAId, itemBId } = await seedTaskWithTwoItems(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);
    expect(result.current.tasks[0].checklist[1].completed).toBe(false);

    const originalUpdate = fakeApi.checklist.update;
    const gateA = deferred();

    fakeApi.checklist.update = async (tId, iId, body) => {
      if (iId === itemAId) {
        await gateA.promise;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // Toggle item A (gate held) and item B (should complete independently).
      const promiseA = result.current.taskActions.toggleChecklistItem(taskId, itemAId);

      // Item A is optimistically true.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Toggle item B — should not be blocked by item A's pending request.
      await result.current.taskActions.toggleChecklistItem(taskId, itemBId);

      // Item B should be completed even while item A is still pending.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[1].completed).toBe(true),
      );

      // Release A.
      gateA.resolve();
      await promiseA;

      // Both items are now completed.
      await waitFor(() => {
        expect(result.current.tasks[0].checklist[0].completed).toBe(true);
        expect(result.current.tasks[0].checklist[1].completed).toBe(true);
      });
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });
});

describe("checklist toggle — guard interop", () => {
  it("existing mutation guard still works for non-toggle actions (double-click prevention)", async () => {
    const { result } = await renderReadyHook();
    await result.current.taskActions.addTask("Test task", "", [], INBOX_LIST_ID);
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    const taskId = result.current.tasks[0].id;

    // Intercept checklist create.
    const originalCreate = fakeApi.checklist.create;
    const gate = deferred();
    let createCallCount = 0;

    fakeApi.checklist.create = async (...args) => {
      createCallCount++;
      await gate.promise;
      return originalCreate(...args);
    };

    try {
      // Double-click addChecklistItem — guard should collapse onto one request.
      const p1 = result.current.taskActions.addChecklistItem(taskId, "Duplicate step");
      const p2 = result.current.taskActions.addChecklistItem(taskId, "Duplicate step");

      gate.resolve();
      await Promise.all([p1, p2]);

      // Only one create should have been sent.
      expect(createCallCount).toBe(1);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist).toHaveLength(1),
      );
    } finally {
      fakeApi.checklist.create = originalCreate;
    }
  });

  it("prevents conflicting text edit from clobbering an in-flight toggle", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);
    expect(result.current.tasks[0].checklist[0].text).toBe("Step A");

    const originalUpdate = fakeApi.checklist.update;
    const toggleGate = deferred();

    fakeApi.checklist.update = async (tId, iId, body) => {
      if (body.completed !== undefined) {
        await toggleGate.promise;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // Start toggle: false → true (optimistic)
      const togglePromise = result.current.taskActions.toggleChecklistItem(taskId, itemId);
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Concurrently edit the text of the same item
      const editPromise = result.current.taskActions.updateChecklistItem(taskId, itemId, {
        text: "Renamed Step",
      });

      // Release toggle request
      toggleGate.resolve();
      await togglePromise;
      await editPromise;

      // Both the toggle completion and the edited text must be preserved
      await waitFor(() => {
        expect(result.current.tasks[0].checklist[0].completed).toBe(true);
        expect(result.current.tasks[0].checklist[0].text).toBe("Renamed Step");
      });
      expect(db.tasks[0].checklist[0].completed).toBe(true);
      expect(db.tasks[0].checklist[0].text).toBe("Renamed Step");
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("reverse order: pending text edit followed by toggle preserves both text and completion", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    expect(result.current.tasks[0].checklist[0].completed).toBe(false);
    expect(result.current.tasks[0].checklist[0].text).toBe("Step A");

    const originalUpdate = fakeApi.checklist.update;
    const editGate = deferred();
    let toggleCallCount = 0;

    fakeApi.checklist.update = async (tId, iId, body) => {
      if (body.text !== undefined) {
        await editGate.promise;
      }
      if (body.completed !== undefined) {
        toggleCallCount++;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // 1. Start a text edit and hold its API response
      const editPromise = result.current.taskActions.updateChecklistItem(taskId, itemId, {
        text: "Step A Renamed",
      });

      // 2. Toggle completion while the edit is pending
      const togglePromise = result.current.taskActions.toggleChecklistItem(taskId, itemId);

      // Verify immediate optimistic checkbox update
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Toggle request must wait for pending edit before calling update
      expect(toggleCallCount).toBe(0);

      // 3. Release edit API response
      editGate.resolve();
      const editResult = await editPromise;
      const toggleResult = await togglePromise;

      expect(editResult).toBe(true);
      expect(toggleResult).toBe(true);

      // 4. Confirm final UI and fake-server state retain both edited text and intended completion value
      await waitFor(() => {
        expect(result.current.tasks[0].checklist[0].text).toBe("Step A Renamed");
        expect(result.current.tasks[0].checklist[0].completed).toBe(true);
      });

      expect(db.tasks[0].checklist[0].text).toBe("Step A Renamed");
      expect(db.tasks[0].checklist[0].completed).toBe(true);
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });

  it("reverse order: edit failure while toggle is queued restores item and allows subsequent operations", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    const originalUpdate = fakeApi.checklist.update;
    const editGate = deferred();
    let shouldFailEdit = true;

    fakeApi.checklist.update = async (tId, iId, body) => {
      if (body.text !== undefined && shouldFailEdit) {
        shouldFailEdit = false;
        await editGate.promise;
        const err = new Error("Server failed saving text");
        err.status = 500;
        err.code = "SERVER_ERROR";
        throw err;
      }
      return originalUpdate(tId, iId, body);
    };

    try {
      // 1. Start a text edit and hold it
      const editPromise = result.current.taskActions.updateChecklistItem(taskId, itemId, {
        text: "Failed Edit Text",
      });

      // 2. Toggle completion while edit is pending
      const togglePromise = result.current.taskActions.toggleChecklistItem(taskId, itemId);

      // Optimistic checkbox update happens immediately
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Release edit failure
      editGate.resolve();

      const editResult = await editPromise;
      const toggleResult = await togglePromise;

      expect(editResult).toBe(false);
      // Toggle proceeds to execute and succeeds
      expect(toggleResult).toBe(true);

      // Completion is saved, original text preserved
      await waitFor(() => {
        expect(result.current.tasks[0].checklist[0].completed).toBe(true);
        expect(result.current.tasks[0].checklist[0].text).toBe("Step A");
      });
      expect(db.tasks[0].checklist[0].completed).toBe(true);
      expect(db.tasks[0].checklist[0].text).toBe("Step A");

      // Verify the item can be operated on again cleanly after failure
      const subsequentEdit = await result.current.taskActions.updateChecklistItem(
        taskId,
        itemId,
        { text: "Recovered Text" },
      );
      expect(subsequentEdit).toBe(true);
      await waitFor(() => {
        expect(result.current.tasks[0].checklist[0].text).toBe("Recovered Text");
      });
      expect(db.tasks[0].checklist[0].text).toBe("Recovered Text");
    } finally {
      fakeApi.checklist.update = originalUpdate;
    }
  });
});
