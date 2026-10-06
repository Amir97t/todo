import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { mutationKeys } from "../src/lib/mutationKeys.js";
import { calls, db, fakeApi, lastTaskQuery, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderReadyHook() {
  const utils = renderHook(() => useAppData());
  await waitFor(() => expect(utils.result.current.status).toBe("ready"));
  return utils;
}

const taskCreates = () => calls.filter((entry) => entry === "tasks.create");

beforeEach(() => {
  reset();
});
const checklistCreates = () =>
  calls.filter((entry) => entry === "checklist.create");

describe("in-flight mutation guard", () => {
  it("collapses a double submit of Add Task into one request", async () => {
    const { result } = await renderReadyHook();

    const first = result.current.taskActions.addTask(
      "Double tapped",
      "",
      [],
      INBOX_LIST_ID,
    );
    const second = result.current.taskActions.addTask(
      "Double tapped",
      "",
      [],
      INBOX_LIST_ID,
    );

    const [a, b] = await Promise.all([first, second]);

    expect(taskCreates()).toHaveLength(1);
    expect(db.tasks).toHaveLength(1);
    // Both callers see the same outcome rather than one silently succeeding.
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it("collapses a double submit of Add Checklist into one request", async () => {
    const { result } = await renderReadyHook();
    await result.current.taskActions.addTask("With checklist", "", [], INBOX_LIST_ID);
    const taskId = db.tasks[0].id;

    const first = result.current.taskActions.addChecklistItem(taskId, "Step");
    const second = result.current.taskActions.addChecklistItem(taskId, "Step");

    const [a, b] = await Promise.all([first, second]);

    expect(checklistCreates()).toHaveLength(1);
    expect(db.tasks[0].checklist).toHaveLength(1);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it("allows concurrent mutations on different resources", async () => {
    const { result } = await renderReadyHook();

    await result.current.taskActions.addTask("Task one", "", [], INBOX_LIST_ID);
    await result.current.taskActions.addTask("Task two", "", [], INBOX_LIST_ID);
    const [first, second] = db.tasks;

    const [a, b] = await Promise.all([
      result.current.taskActions.addChecklistItem(first.id, "for one"),
      result.current.taskActions.addChecklistItem(second.id, "for two"),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(checklistCreates()).toHaveLength(2);
    expect(db.tasks[0].checklist).toHaveLength(1);
    expect(db.tasks[1].checklist).toHaveLength(1);
  });

  it("releases the guard after a failure so a retry can succeed", async () => {
    const { result } = await renderReadyHook();
    const key = mutationKeys.createTask(INBOX_LIST_ID);

    const original = fakeApi.tasks.create;
    let failOnce = true;
    fakeApi.tasks.create = async (...args) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("transient failure");
      }
      return original(...args);
    };

    try {
      expect(await result.current.taskActions.addTask("Retry me", "", [], INBOX_LIST_ID)).toBe(false);
      await waitFor(() => expect(result.current.isPending(key)).toBe(false));

      expect(await result.current.taskActions.addTask("Retry me", "", [], INBOX_LIST_ID)).toBe(true);
      expect(db.tasks).toHaveLength(1);
    } finally {
      fakeApi.tasks.create = original;
    }
  });

  it("does not block an unrelated mutation while one is pending", async () => {
    const { result } = await renderReadyHook();

    const gate = deferred();
    const original = fakeApi.tasks.create;
    fakeApi.tasks.create = async () => gate.promise;

    const pendingTask = result.current.taskActions.addTask(
      "Slow",
      "",
      [],
      INBOX_LIST_ID,
    );

    // A different operation must still be able to run.
    expect(await result.current.addList("While pending", "folder")).toBe(true);

    gate.resolve({
      id: "slow-id",
      title: "Slow",
      description: "",
      completed: false,
      listId: INBOX_LIST_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      checklist: [],
    });

    expect(await pendingTask).toBe(true);
    fakeApi.tasks.create = original;
  });
});

describe("submit controls reflect pending state", () => {
  async function openApp() {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await waitFor(() => expect(lastTaskQuery.value?.sort).toBeDefined());
  }

  it("disables Add Task while pending and re-enables it after a failure", async () => {
    const gate = deferred();
    const original = fakeApi.tasks.create;
    fakeApi.tasks.create = () => gate.promise;

    try {
      await openApp();

      fireEvent.click(screen.getByRole("button", { name: "Add new task" }));
      fireEvent.change(await screen.findByPlaceholderText("Task title..."), {
        target: { value: "Pending submit" },
      });

      const submit = screen.getByRole("button", { name: "Add Task" });
      expect(submit.disabled).toBe(false);

      fireEvent.click(submit);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Adding…" }).disabled).toBe(
          true,
        ),
      );

      // The request fails, so the dialog must stay open and the button recover.
      await act(async () => gate.reject(new Error("nope")));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Add Task" }).disabled,
        ).toBe(false),
      );
      expect(screen.getByPlaceholderText("Task title...")).toBeTruthy();
      expect(db.tasks).toHaveLength(0);
    } finally {
      fakeApi.tasks.create = original;
    }
  });

  it("disables the checklist confirm while pending", async () => {
    const original = fakeApi.checklist.create;
    const gate = deferred();
    fakeApi.checklist.create = async (taskId, body) => {
      await gate.promise;
      return original(taskId, body);
    };

    try {
      await openApp();

      fireEvent.click(screen.getByRole("button", { name: "Add new task" }));
      fireEvent.change(await screen.findByPlaceholderText("Task title..."), {
        target: { value: "For checklist" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add Task" }));

      await waitFor(() => expect(db.tasks).toHaveLength(1));

      fireEvent.click(
        await screen.findByRole("button", { name: "Add checklist item" }),
      );
      fireEvent.change(await screen.findByLabelText("New checklist item"), {
        target: { value: "Step one" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Add checklist item" }).disabled,
        ).toBe(true),
      );

      await act(async () => gate.reject(new Error("nope")));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Add checklist item" }).disabled,
        ).toBe(false),
      );
      expect(screen.getByLabelText("New checklist item")).toBeTruthy();
      expect(db.tasks[0].checklist).toHaveLength(0);
    } finally {
      fakeApi.checklist.create = original;
    }
  });
});
