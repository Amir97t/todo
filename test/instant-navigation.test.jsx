import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import { queryKey } from "../src/hooks/useAppData.js";
import { calls, db, fakeApi, lastTaskQuery, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

vi.mock("../src/lib/authSession.js", async () => {
  const actual = await vi.importActual("../src/lib/authSession.js");
  return { ...actual, getAccessTokenSubject: () => "test-user" };
});

vi.mock("../src/context/AuthContext.js", () => ({
  useAuth: () => ({
    status: "authenticated",
    isAuthenticated: true,
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

const LIST_A_NAME = "Work";
const LIST_B_NAME = "Personal";

function seed({ taskRows = [], selectedList = "l1" } = {}) {
  localStorage.setItem(
    "todo-app-lists",
    JSON.stringify([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "l1", name: LIST_A_NAME, icon: "briefcase" },
      { id: "l2", name: LIST_B_NAME, icon: "user" },
    ]),
  );
  localStorage.setItem("todo-app-tasks", JSON.stringify(taskRows));
  localStorage.setItem("todo-app-selected-list", JSON.stringify(selectedList));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
  reset();
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function boot(path = "/") {
  window.history.replaceState({}, "", path);
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
  await waitFor(() => expect(lastTaskQuery.value?.sort).toBeDefined());
}

function listAId() {
  return db.lists.find((l) => l.name === LIST_A_NAME).id;
}

function listBId() {
  return db.lists.find((l) => l.name === LIST_B_NAME).id;
}

beforeEach(() => {
  seed();
});

describe("Instant navigation and query responsiveness", () => {
  it("publishes query immediately when switching lists without waiting for search debounce", async () => {
    await boot();

    const initialGets = calls.filter((c) => c === "tasks.get").length;

    // Click Personal list in sidebar
    fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));

    // Query must be published immediately
    await waitFor(() => {
      expect(lastTaskQuery.value.listId).toBe(listBId());
      expect(lastTaskQuery.value.completed).toBe(false);
    });

    expect(calls.filter((c) => c === "tasks.get").length).toBeGreaterThan(initialGets);
  });

  it("publishes query immediately when switching Active to Completed", async () => {
    await boot();

    // Click Completed in navigation (aria-label="Completed tasks")
    fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));

    await waitFor(() => {
      expect(lastTaskQuery.value.completed).toBe(true);
      expect(lastTaskQuery.value).not.toHaveProperty("listId");
    });
  });

  it("clearing search updates the query immediately", async () => {
    await boot();

    // Open search and type
    fireEvent.click(await screen.findByRole("button", { name: "Open search" }));
    const searchInput = await screen.findByLabelText("Search tasks");
    fireEvent.change(searchInput, { target: { value: "urgent" } });

    await waitFor(() => expect(lastTaskQuery.value.q).toBe("urgent"));

    // Clear search
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    // Should immediately restore listId and remove q
    await waitFor(() => {
      expect(lastTaskQuery.value).not.toHaveProperty("q");
      expect(lastTaskQuery.value.listId).toBe(listAId());
    });
  });

  it("displays cached results immediately on returning to a previously loaded query", async () => {
    // Seed tasks in List A and List B
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Work Task A1",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
        {
          id: "t-b1",
          title: "Personal Task B1",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();

    // List A is loaded and should show Work Task A1
    await waitFor(() => expect(screen.getByText("Work Task A1")).toBeTruthy());

    // Switch to List B
    fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
    await waitFor(() => expect(screen.getByText("Personal Task B1")).toBeTruthy());

    // Now gate tasksApi.get so the next network response is delayed
    const originalGet = fakeApi.tasks.get;
    const gate = deferred();
    let revalidateCalled = false;

    fakeApi.tasks.get = async (...args) => {
      revalidateCalled = true;
      await gate.promise;
      return originalGet(...args);
    };

    try {
      // Switch back to List A
      fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));

      // Cached result for List A must appear immediately, before network response
      expect(screen.getByText("Work Task A1")).toBeTruthy();
      expect(screen.queryByText("Personal Task B1")).toBeNull();

      // Release the network revalidation
      gate.resolve();
      await waitFor(() => expect(revalidateCalled).toBe(true));
      expect(screen.getByText("Work Task A1")).toBeTruthy();
    } finally {
      fakeApi.tasks.get = originalGet;
    }
  });

  it("invalidates cache after mutations so stale entries do not resurrect", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Deletable Task",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    await waitFor(() => expect(screen.getByText("Deletable Task")).toBeTruthy());

    // Delete the task
    fireEvent.click(await screen.findByRole("button", { name: "Delete task" }));
    const dialog = await screen.findByRole("dialog");
    const confirmBtn = within(dialog).getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.queryByText("Deletable Task")).toBeNull());

    // Switch to List B and back to List A
    fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
    await waitFor(() => expect(lastTaskQuery.value.listId).toBe(listBId()));

    fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));
    await waitFor(() => expect(lastTaskQuery.value.listId).toBe(listAId()));

    // The deleted task must NOT resurrect from cache
    expect(screen.queryByText("Deletable Task")).toBeNull();
  });

  it("an older response never overwrites a newer query's results", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "List A Task",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
        {
          id: "t-b1",
          title: "List B Task",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    await waitFor(() => expect(screen.getByText("List A Task")).toBeTruthy());

    const originalGet = fakeApi.tasks.get;
    const slowGate = deferred();
    let callCount = 0;

    fakeApi.tasks.get = async (query, signal) => {
      callCount++;
      if (query?.listId === listBId() && callCount === 2) {
        // Make query for B very slow
        await slowGate.promise;
      }
      return originalGet(query, signal);
    };

    try {
      // Navigate to List B (slow)
      fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));

      // Quickly navigate back to List A
      fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));

      // Now release List B's slow response
      slowGate.resolve();

      // Final view must be List A, not overwritten by List B
      await waitFor(() => {
        expect(screen.getByText("List A Task")).toBeTruthy();
        expect(screen.queryByText("List B Task")).toBeNull();
      });
    } finally {
      fakeApi.tasks.get = originalGet;
    }
  });

  it("switching to an uncached query does not display the previous query's tasks while loading", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Work Task A1",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
        {
          id: "t-b1",
          title: "Personal Task B1",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    // Verify List A is loaded and showing Work Task A1
    await waitFor(() => expect(screen.getByText("Work Task A1")).toBeTruthy());

    // Intercept tasks.get so List B is held pending
    const originalGet = fakeApi.tasks.get;
    const gateB = deferred();

    fakeApi.tasks.get = async (query, signal) => {
      if (query?.listId === listBId()) {
        await gateB.promise;
      }
      return originalGet(query, signal);
    };

    try {
      // Click List B (Personal) in sidebar
      fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));

      // Immediately upon click / during loading:
      // 1. The previous query's tasks ("Work Task A1") must NOT be displayed under List B
      expect(screen.queryByText("Work Task A1")).toBeNull();
      // 2. The uncached new tasks are not yet displayed
      expect(screen.queryByText("Personal Task B1")).toBeNull();
      // 3. Loading state is displayed
      await waitFor(() => {
        expect(screen.getByText("Loading your tasks…")).toBeTruthy();
      });

      // Release network response for List B
      gateB.resolve();

      // Correct results now appear
      await waitFor(() => {
        expect(screen.getByText("Personal Task B1")).toBeTruthy();
      });
      expect(screen.queryByText("Work Task A1")).toBeNull();
      expect(screen.queryByText("Loading your tasks…")).toBeNull();
    } finally {
      fakeApi.tasks.get = originalGet;
    }
  });

  it("invalidates cache after checklist mutation so navigating away and back does not resurrect stale checklist state", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Task with checklist",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [
            {
              id: "item-1",
              text: "Initial Checklist Item",
              completed: false,
              position: 0,
            },
          ],
        },
        {
          id: "t-b1",
          title: "Personal Task",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    await waitFor(() => expect(screen.getByText("Task with checklist")).toBeTruthy());
    expect(screen.getByText("Initial Checklist Item")).toBeTruthy();

    // Toggle checklist item button
    const toggleBtn = screen.getByRole("button", {
      name: 'Mark "Initial Checklist Item" complete',
    });
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: 'Mark "Initial Checklist Item" incomplete',
        }),
      ).toBeTruthy();
    });

    // Navigate to List B
    fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
    await waitFor(() => expect(screen.getByText("Personal Task")).toBeTruthy());

    // Navigate back to List A
    fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));
    await waitFor(() => expect(screen.getByText("Task with checklist")).toBeTruthy());

    // Stale unchecked state must NOT resurrect
    const restoredBtn = screen.getByRole("button", {
      name: 'Mark "Initial Checklist Item" incomplete',
    });
    expect(restoredBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("invalidates cache after task completed so navigating away and back does not resurrect completed task in active list", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Active Task to Complete",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
        {
          id: "t-b1",
          title: "Personal Task",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    await waitFor(() => expect(screen.getByText("Active Task to Complete")).toBeTruthy());

    // Complete the task via its checkbox
    const taskCheckbox = screen.getByRole("checkbox", {
      name: 'Mark "Active Task to Complete" as completed',
    });
    fireEvent.click(taskCheckbox);

    // Task disappears from Active list
    await waitFor(() => expect(screen.queryByText("Active Task to Complete")).toBeNull());

    // Navigate to List B
    fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
    await waitFor(() => expect(screen.getByText("Personal Task")).toBeTruthy());

    // Navigate back to List A
    fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));
    await waitFor(() => expect(lastTaskQuery.value.listId).toBe(listAId()));

    // The completed task must NOT resurrect in List A active view
    expect(screen.queryByText("Active Task to Complete")).toBeNull();
  });

  it("pre-mutation slow fetch does not repopulate cache with obsolete data after a mutation", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Task Pre-Mutation",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [],
        },
        {
          id: "t-b1",
          title: "Personal Task",
          description: "",
          completed: false,
          listId: "l2",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    await waitFor(() => expect(screen.getByText("Task Pre-Mutation")).toBeTruthy());

    const originalGet = fakeApi.tasks.get;
    const slowFetchGate = deferred();
    let gateApplied = false;

    // Next time tasks.get runs for List A, hold it
    fakeApi.tasks.get = async (query, signal) => {
      if (query?.listId === listAId() && !gateApplied) {
        gateApplied = true;
        await slowFetchGate.promise;
      }
      return originalGet(query, signal);
    };

    try {
      // Trigger a delete mutation while the fetch is held
      fireEvent.click(await screen.findByRole("button", { name: "Delete task" }));
      const dialog = await screen.findByRole("dialog");
      const confirmBtn = within(dialog).getByRole("button", { name: "Delete" });
      fireEvent.click(confirmBtn);

      await waitFor(() => expect(screen.queryByText("Task Pre-Mutation")).toBeNull());

      // Release the slow pre-mutation fetch (which would have returned Task Pre-Mutation)
      slowFetchGate.resolve();

      // Even after slow fetch resolves, the deleted task must not appear
      expect(screen.queryByText("Task Pre-Mutation")).toBeNull();

      // Switch to List B and back to List A
      fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
      await waitFor(() => expect(screen.getByText("Personal Task")).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));
      await waitFor(() => expect(lastTaskQuery.value.listId).toBe(listAId()));

      // The pre-mutation data was not cached, task remains deleted
      expect(screen.queryByText("Task Pre-Mutation")).toBeNull();
    } finally {
      fakeApi.tasks.get = originalGet;
    }
  });

  it("preserves visible task and optimistic completion state during background revalidation after checklist toggle", async () => {
    seed({
      taskRows: [
        {
          id: "t-a1",
          title: "Visible Task",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000000000,
          checklist: [
            {
              id: "item-1",
              text: "Checklist Item 1",
              completed: false,
              position: 0,
            },
          ],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    // 1. Loads a query containing a visible task and checklist item.
    await waitFor(() => expect(screen.getByText("Visible Task")).toBeTruthy());
    expect(screen.getByText("Checklist Item 1")).toBeTruthy();

    const originalGet = fakeApi.tasks.get;
    const revalGate = deferred();
    let revalCalled = false;

    // 2. Trigger checklist toggle, and gate the follow-up tasks.get call
    const toggleBtn = screen.getByRole("button", {
      name: 'Mark "Checklist Item 1" complete',
    });
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

    // Intercept tasks.get so the follow-up revalidation query is held pending
    fakeApi.tasks.get = async (query, signal) => {
      revalCalled = true;
      await revalGate.promise;
      return originalGet(query, signal);
    };

    try {
      // Toggle the item
      fireEvent.click(toggleBtn);

      // Checkbox flips optimistically to completed
      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: 'Mark "Checklist Item 1" incomplete',
          }),
        ).toBeTruthy();
      });

      // Wait until the background revalidation tasks.get has been triggered
      await waitFor(() => expect(revalCalled).toBe(true));

      // 4. Verifies that the visible task and optimistic completion state remain on screen while revalidation is pending
      expect(screen.getByText("Visible Task")).toBeTruthy();
      expect(screen.getByText("Checklist Item 1")).toBeTruthy();
      const updatedBtn = screen.getByRole("button", {
        name: 'Mark "Checklist Item 1" incomplete',
      });
      expect(updatedBtn.getAttribute("aria-pressed")).toBe("true");
      // Must NOT show full-page loading placeholder
      expect(screen.queryByText("Loading your tasks…")).toBeNull();

      // 5. Releases the fetch and verifies the final state is correct
      revalGate.resolve();

      await waitFor(() => {
        const finalBtn = screen.getByRole("button", {
          name: 'Mark "Checklist Item 1" incomplete',
        });
        expect(finalBtn.getAttribute("aria-pressed")).toBe("true");
      });
      expect(screen.getByText("Visible Task")).toBeTruthy();
      expect(screen.queryByText("Loading your tasks…")).toBeNull();
    } finally {
      fakeApi.tasks.get = originalGet;
    }
  });
});

describe("queryKey serialization and collision resistance", () => {
  it("serializes semantically equivalent queries to identical keys regardless of key insertion order", () => {
    const q1 = { listId: "l1", completed: false, sort: "newest" };
    const q2 = { sort: "newest", completed: false, listId: "l1" };
    const q3 = { completed: false, listId: "l1", sort: "newest" };

    expect(queryKey(q1)).toBe(queryKey(q2));
    expect(queryKey(q2)).toBe(queryKey(q3));
  });

  it("prevents collisions between queries containing & or = in values and queries with multiple keys", () => {
    const queryA = { q: "foo=1&bar=2" };
    const queryB = { q: "foo=1", bar: "2" };
    const queryC = { foo: "1&bar=2" };
    const queryD = { foo: "1", bar: "2" };

    const keys = [queryKey(queryA), queryKey(queryB), queryKey(queryC), queryKey(queryD)];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(4);
  });
});
