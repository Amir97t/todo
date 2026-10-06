import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import {
  MigrationError,
  readMigrationRecord,
  runMigration,
} from "../src/lib/migration.js";
import { calls, db, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

const MIGRATION_LOCK = "todo-app-migration";
const INBOX_ONLY_LISTS = [{ id: "inbox", name: "Inbox", icon: "inbox" }];

function oneLegacyTask(overrides = {}) {
  return {
    id: "legacy-1",
    title: "Only task",
    description: "",
    completed: false,
    listId: "inbox",
    createdAt: 1700000000000,
    checklist: [],
    ...overrides,
  };
}

function seedInboxOnlyWithOneTask(taskRow = oneLegacyTask()) {
  localStorage.setItem("todo-app-lists", JSON.stringify(INBOX_ONLY_LISTS));
  localStorage.setItem("todo-app-tasks", JSON.stringify([taskRow]));
  localStorage.setItem("todo-app-selected-list", JSON.stringify("inbox"));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
}

const taskCreates = () => calls.filter((entry) => entry === "tasks.create");

/**
 * Two-level locking: a module-level single-flight promise guards callers in
 * one JS runtime (StrictMode's double effect), and navigator.locks guards
 * callers across tabs, which do not share module memory.
 *
 * Cross-tab exclusion itself is NOT proven here — every test file shares a
 * single module registry, so Level 1 always de-duplicates before Level 2 can
 * be observed. The lock is asserted by name below; genuinely proving two
 * independent runtimes would need a multi-context browser harness
 * (Playwright/WebDriver) that this project does not have.
 */
describe("migration single-flight", () => {
  it("runs one pipeline when called twice without awaiting", async () => {
    seedInboxOnlyWithOneTask();
    reset();

    // Deliberately un-awaited: both callers race for the same work.
    const first = runMigration();
    const second = runMigration();

    const [a, b] = await Promise.all([first, second]);

    expect(taskCreates()).toHaveLength(1);
    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].title).toBe("Only task");
    expect(a.record.status).toBe("done");
    expect(b.record.status).toBe("done");
    expect(readMigrationRecord().migratedTaskIds).toEqual(["legacy-1"]);
  });

  it("acquires the cross-tab migration lock", async () => {
    seedInboxOnlyWithOneTask();
    reset();

    const spy = vi.spyOn(navigator.locks, "request");

    await runMigration();

    expect(spy).toHaveBeenCalledWith(MIGRATION_LOCK, expect.any(Function));
    spy.mockRestore();
  });

  it("fails safely when cross-tab locking is unavailable", async () => {
    seedInboxOnlyWithOneTask();
    reset();

    const locks = navigator.locks;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });

    try {
      await expect(runMigration()).rejects.toBeInstanceOf(MigrationError);
    } finally {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: locks,
      });
    }

    // Nothing may be written when the lock cannot be taken.
    expect(db.tasks).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(readMigrationRecord()).toBeNull();
  });

  it("releases the in-flight slot so a later retry can run", async () => {
    reset();

    // A malformed task aborts the pipeline before anything is created.
    seedInboxOnlyWithOneTask(oneLegacyTask({ createdAt: "not-a-number" }));

    await expect(runMigration()).rejects.toBeInstanceOf(MigrationError);
    expect(readMigrationRecord()?.status).not.toBe("done");

    // Repair the fixture; a failed run must not be cached.
    seedInboxOnlyWithOneTask();

    const retried = await runMigration();

    expect(retried.record.status).toBe("done");
    expect(db.tasks).toHaveLength(1);
    expect(taskCreates()).toHaveLength(1);
  });
});

describe("StrictMode mount (the original bug)", () => {
  it("migrates exactly one task and reports no error", async () => {
    seedInboxOnlyWithOneTask();
    reset();

    render(
      <ThemeProvider>
        <StrictMode>
          <App />
        </StrictMode>
      </ThemeProvider>,
    );

    await waitFor(() => expect(taskCreates()).toHaveLength(1));
    await waitFor(() => expect(readMigrationRecord()?.status).toBe("done"));

    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].title).toBe("Only task");
    expect(readMigrationRecord().migratedTaskIds).toEqual(["legacy-1"]);
    expect(screen.queryByText("Could not load your data")).toBeNull();
  });
});
