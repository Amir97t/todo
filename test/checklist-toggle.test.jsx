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

beforeEach(() => {
  reset();
});

describe("checklist toggle — optimistic update", () => {
  it("flips the item immediately before the API responds", async () => {
    const { result } = await renderReadyHook();
    const { taskId, itemId } = await seedTaskWithChecklistItem(result);

    // The item starts uncompleted.
    expect(result.current.tasks[0].checklist[0].completed).toBe(false);

    // Intercept the API so it hangs until we release it.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const originalUpdate = fakeApi.checklist.update;
    fakeApi.checklist.update = async (...args) => {
      await gate;
      return originalUpdate(...args);
    };

    try {
      // Fire the toggle — don't await it yet.
      const togglePromise = result.current.taskActions.toggleChecklistItem(
        taskId,
        itemId,
      );

      // The item should be optimistically flipped while the request is still pending.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(true),
      );

      // Now let the API respond.
      release();
      await togglePromise;

      // After reconciliation the item is still completed (server agreed).
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

    // Make the API reject.
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

      // The item should be rolled back to its original state.
      await waitFor(() =>
        expect(result.current.tasks[0].checklist[0].completed).toBe(false),
      );

      // An error message should be set and rendered.
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

    // The server's data matches.
    expect(db.tasks[0].checklist[0].completed).toBe(true);
  });
});
