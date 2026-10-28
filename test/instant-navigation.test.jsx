import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import useAppData, { insertOrUpdateNewest, queryKey } from "../src/hooks/useAppData.js";
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
  localStorage.removeItem("todo-app-migration-v1:test-user");
  localStorage.removeItem("todo-app-legacy-owner");
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

  it(
    "invalidates cache after checklist mutation so navigating away and back does not resurrect stale checklist state",
    async () => {
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
      await waitFor(() => {
        const restoredBtn = screen.getByRole("button", {
          name: 'Mark "Initial Checklist Item" incomplete',
        });
        expect(restoredBtn.getAttribute("aria-pressed")).toBe("true");
      });
    },
    15000
  );

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
      await waitFor(
        () => {
          expect(
            screen.getByRole("button", {
              name: 'Mark "Checklist Item 1" incomplete',
            }),
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );

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

  it(
    "renders checklist optimistic toggle with progress count and strikethrough before delayed API resolves",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-check",
            title: "Checklist Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [
              { id: "ci-1", text: "Buy milk", completed: false, position: 0 },
              { id: "ci-2", text: "Buy bread", completed: false, position: 1 },
            ],
          },
        ],
        selectedList: "l1",
      });

      await boot();
      await waitFor(() => expect(screen.getByText("Checklist Task")).toBeTruthy());
      expect(screen.getByText("0/2")).toBeTruthy();

      const originalChecklistUpdate = fakeApi.checklist.update;
      const updateGate = deferred();

      fakeApi.checklist.update = async (...args) => {
        await updateGate.promise;
        return originalChecklistUpdate(...args);
      };

      try {
        const toggleBtn = screen.getByRole("button", {
          name: 'Mark "Buy milk" complete',
        });
        fireEvent.click(toggleBtn);

        // Verifies checkbox, strike-through, and progress count update BEFORE API resolves
        await waitFor(
          () => {
            expect(
              screen.getByRole("button", {
                name: 'Mark "Buy milk" incomplete',
              }),
            ).toBeTruthy();
          },
          { timeout: 5000 },
        );
        const milkText = screen.getByText("Buy milk");
        expect(milkText.className).toContain("is-done");
        expect(screen.getByText("1/2")).toBeTruthy();

        // Confirms no full-page loading flash
        expect(screen.queryByText("Loading your tasks…")).toBeNull();

        // Resolves request and verifies final states
        updateGate.resolve();

        await waitFor(() => {
          expect(db.tasks[0].checklist[0].completed).toBe(true);
        });
        expect(screen.getByText("1/2")).toBeTruthy();
      } finally {
        fakeApi.checklist.update = originalChecklistUpdate;
      }
    },
    15000,
  );
});

describe("Task completion toggle — optimistic and serialized", () => {
  it("Test A — Complete an Active task: disappears from Active, appears in warm Completed before PATCH resolves", async () => {
    seed({
      taskRows: [
        {
          id: "t-1",
          title: "Active Task 1",
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
    // 1. Load the Active view and warm the Completed query cache
    await waitFor(() => expect(screen.getByText("Active Task 1")).toBeTruthy());

    fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
    await waitFor(() => expect(screen.getByText("No completed tasks")).toBeTruthy());

    fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
    await waitFor(() => expect(screen.getByText("Active Task 1")).toBeTruthy());

    // 2. Intercept and delay the task update request
    const originalUpdate = fakeApi.tasks.update;
    const gate = deferred();
    let updateCalled = false;

    fakeApi.tasks.update = async (...args) => {
      updateCalled = true;
      await gate.promise;
      return originalUpdate(...args);
    };

    try {
      // 3. Click a task's completion checkbox
      const checkbox = screen.getByRole("checkbox", {
        name: 'Mark "Active Task 1" as completed',
      });
      fireEvent.click(checkbox);

      // 4. Before resolving the PATCH, verify the task disappears from the rendered Active list
      expect(screen.queryByText("Active Task 1")).toBeNull();
      await waitFor(() => expect(updateCalled).toBe(true));

      // 5. Switch to Completed while the PATCH is still pending
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));

      // 6. Verify the task is already present exactly once in the warm Completed view
      await waitFor(() => expect(screen.getByText("Active Task 1")).toBeTruthy());
      const allMatches = screen.getAllByText("Active Task 1");
      expect(allMatches).toHaveLength(1);
      const completedCheckbox = screen.getByRole("checkbox", {
        name: 'Mark "Active Task 1" as active',
      });
      expect(completedCheckbox.checked).toBe(true);

      // 7. Resolve the PATCH and verify the final result remains correct
      gate.resolve();
      await waitFor(() => expect(db.tasks[0].completed).toBe(true));
      expect(screen.getByText("Active Task 1")).toBeTruthy();
    } finally {
      fakeApi.tasks.update = originalUpdate;
    }
  });

  it("Test B — Uncomplete a Completed task: disappears from Completed, appears in warm Active in correct position before PATCH resolves", async () => {
    seed({
      taskRows: [
        {
          id: "t-newer",
          title: "Active Newer",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000003000,
          checklist: [],
        },
        {
          id: "t-middle",
          title: "Completed Middle",
          description: "",
          completed: true,
          listId: "l1",
          createdAt: 1700000002000,
          checklist: [],
        },
        {
          id: "t-older",
          title: "Active Older",
          description: "",
          completed: false,
          listId: "l1",
          createdAt: 1700000001000,
          checklist: [],
        },
      ],
      selectedList: "l1",
    });

    await boot();
    // 1. Load and warm both Active and Completed views
    await waitFor(() => expect(screen.getByText("Active Newer")).toBeTruthy());
    expect(screen.getByText("Active Older")).toBeTruthy();
    expect(screen.queryByText("Completed Middle")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
    await waitFor(() => expect(screen.getByText("Completed Middle")).toBeTruthy());
    expect(screen.queryByText("Active Newer")).toBeNull();
    expect(screen.queryByText("Active Older")).toBeNull();

    // 2. Delay the update request
    const originalUpdate = fakeApi.tasks.update;
    const gate = deferred();
    let updateCalled = false;

    fakeApi.tasks.update = async (...args) => {
      updateCalled = true;
      await gate.promise;
      return originalUpdate(...args);
    };

    try {
      // 3. Uncomplete a task in Completed
      const checkbox = screen.getByRole("checkbox", {
        name: 'Mark "Completed Middle" as active',
      });
      fireEvent.click(checkbox);

      // 4. Verify it immediately disappears from Completed
      expect(screen.queryByText("Completed Middle")).toBeNull();
      await waitFor(() => expect(updateCalled).toBe(true));

      // 5. Switch to Active before the request resolves
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));

      // 6. Verify it appears in the correct chronological position without duplication
      await waitFor(() => expect(screen.getByText("Completed Middle")).toBeTruthy());
      expect(screen.getAllByText("Completed Middle")).toHaveLength(1);

      const renderedTasks = screen.getAllByRole("heading", { level: 3 });
      const titles = renderedTasks.map((el) => el.textContent.trim());
      expect(titles).toEqual(["Active Newer", "Completed Middle", "Active Older"]);

      // 7. Resolve the request and verify it remains correctly placed
      gate.resolve();
      await waitFor(() => {
        expect(
          db.tasks.find((t) => t.title === "Completed Middle")?.completed,
        ).toBe(false);
      });

      const finalRendered = screen.getAllByRole("heading", { level: 3 });
      expect(finalRendered.map((el) => el.textContent.trim())).toEqual([
        "Active Newer",
        "Completed Middle",
        "Active Older",
      ]);
    } finally {
      fakeApi.tasks.update = originalUpdate;
    }
  });

  it(
    "Test C — Failure rollback: task moves optimistically, request fails, task returns to source view and error shown",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-1",
            title: "Fail Task",
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
      await waitFor(() => expect(screen.getByText("Fail Task")).toBeTruthy());

      // Warm Completed query cache
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      await waitFor(() => expect(screen.getByText("No completed tasks")).toBeTruthy());
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => expect(screen.getByText("Fail Task")).toBeTruthy());

      const originalUpdate = fakeApi.tasks.update;
      const failGate = deferred();
      let shouldFail = true;

      fakeApi.tasks.update = async (id, body) => {
        if (shouldFail) {
          shouldFail = false;
          await failGate.promise;
          const err = new Error("Network error toggling task");
          err.status = 500;
          throw err;
        }
        return originalUpdate(id, body);
      };

      try {
        const checkbox = screen.getByRole("checkbox", {
          name: 'Mark "Fail Task" as completed',
        });

        // 1 & 2: Start task toggle, delay API response, verify task moves optimistically
        fireEvent.click(checkbox);
        expect(screen.queryByText("Fail Task")).toBeNull();

        // Switch to Completed to verify optimistic presence
        fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
        expect(screen.getByText("Fail Task")).toBeTruthy();

        // 3 & 4: Reject the request, verify task returns to source view and disappears from target view
        failGate.resolve();

        // After failure, task disappears from Completed view
        await waitFor(() => {
          expect(screen.queryByText("Fail Task")).toBeNull();
        });

        // Switch to Active view: task is restored in source view
        fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
        await waitFor(() => expect(screen.getByText("Fail Task")).toBeTruthy());
        expect(db.tasks[0].completed).toBe(false);

        // Verify action error alert is displayed
        expect(screen.getByRole("alert")).toBeTruthy();

        // 5: Verify a subsequent toggle can succeed
        const restoredCheckbox = screen.getByRole("checkbox", {
          name: 'Mark "Fail Task" as completed',
        });
        fireEvent.click(restoredCheckbox);
        expect(screen.queryByText("Fail Task")).toBeNull();

        await waitFor(() => expect(db.tasks[0].completed).toBe(true));
      } finally {
        fakeApi.tasks.update = originalUpdate;
      }
    },
    15000,
  );

  it("Test D — Rapid clicks and stale fetches: 2 and 3 rapid clicks produce correct final persisted state and membership", async () => {
    seed({
      taskRows: [
        {
          id: "t-1",
          title: "Rapid Task",
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
    await waitFor(() => expect(screen.getByText("Rapid Task")).toBeTruthy());

    // Warm Completed view
    fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
    await waitFor(() => expect(screen.getByText("No completed tasks")).toBeTruthy());
    fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
    await waitFor(() => expect(screen.getByText("Rapid Task")).toBeTruthy());

    const originalUpdate = fakeApi.tasks.update;
    const originalGet = fakeApi.tasks.get;
    const gate1 = deferred();
    let updateCalls = 0;

    fakeApi.tasks.update = async (id, body) => {
      updateCalls++;
      if (updateCalls === 1) {
        await gate1.promise;
      }
      return originalUpdate(id, body);
    };

    // Stale fetch gate: a query fetch that returns obsolete task placement
    const staleGetGate = deferred();
    let getCalls = 0;
    fakeApi.tasks.get = async (query, signal) => {
      getCalls++;
      if (getCalls === 4) {
        await staleGetGate.promise;
      }
      return originalGet(query, signal);
    };

    try {
      // --- PART 1: Two rapid clicks (Active -> Completed -> Active) ---
      // Click 1 in Active view (moves to Completed)
      const checkboxActive = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as completed',
      });
      fireEvent.click(checkboxActive);
      expect(screen.queryByText("Rapid Task")).toBeNull();

      // Switch to Completed
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      expect(screen.getByText("Rapid Task")).toBeTruthy();

      // Click 2 in Completed view while request 1 is still in flight (moves back to Active)
      const checkboxCompleted = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as active',
      });
      fireEvent.click(checkboxCompleted);
      expect(screen.queryByText("Rapid Task")).toBeNull();

      // Release delayed/stale GET query
      staleGetGate.resolve();

      // Release request 1
      gate1.resolve();

      // Serialized queue processes request 2 (completed: false)
      await waitFor(() => expect(updateCalls).toBe(2));
      await waitFor(() => expect(db.tasks[0].completed).toBe(false));

      // Task is restored in Active view, not present in Completed view
      expect(screen.queryByText("Rapid Task")).toBeNull();
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => expect(screen.getByText("Rapid Task")).toBeTruthy());
      const activeCheckboxAfter2 = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as completed',
      });
      expect(activeCheckboxAfter2.checked).toBe(false);

      // --- PART 2: Three rapid clicks (Active -> Completed -> Active -> Completed) ---
      const gate2 = deferred();
      let part2UpdateCalls = 0;
      fakeApi.tasks.update = async (id, body) => {
        part2UpdateCalls++;
        if (part2UpdateCalls === 1) {
          await gate2.promise;
        }
        return originalUpdate(id, body);
      };

      // Click 1 (Active -> Completed)
      fireEvent.click(activeCheckboxAfter2);
      expect(screen.queryByText("Rapid Task")).toBeNull();

      // Switch to Completed
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      expect(screen.getByText("Rapid Task")).toBeTruthy();

      // Click 2 (Completed -> Active)
      const checkboxCompleted2 = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as active',
      });
      fireEvent.click(checkboxCompleted2);
      expect(screen.queryByText("Rapid Task")).toBeNull();

      // Switch to Active
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      expect(screen.getByText("Rapid Task")).toBeTruthy();

      // Click 3 (Active -> Completed)
      const checkboxActive3 = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as completed',
      });
      fireEvent.click(checkboxActive3);
      expect(screen.queryByText("Rapid Task")).toBeNull();

      // Release first in-flight request of part 2
      gate2.resolve();

      // Wait for all updates to settle to final desired state: completed = true
      await waitFor(() => expect(db.tasks[0].completed).toBe(true));

      // Final membership: NOT in Active view, present in Completed view
      expect(screen.queryByText("Rapid Task")).toBeNull();
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      await waitFor(() => expect(screen.getByText("Rapid Task")).toBeTruthy());
      const finalCheckbox = screen.getByRole("checkbox", {
        name: 'Mark "Rapid Task" as active',
      });
      expect(finalCheckbox.checked).toBe(true);
    } finally {
      fakeApi.tasks.update = originalUpdate;
      fakeApi.tasks.get = originalGet;
    }
  });

  it("a task-status response does not overwrite a newer desired state", async () => {
    seed({
      taskRows: [
        {
          id: "t-1",
          title: "Stale Task",
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
    await waitFor(() => expect(screen.getByText("Stale Task")).toBeTruthy());

    // Warm completed view
    fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
    await waitFor(() => expect(screen.getByText("No completed tasks")).toBeTruthy());
    fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
    await waitFor(() => expect(screen.getByText("Stale Task")).toBeTruthy());

    const originalUpdate = fakeApi.tasks.update;
    const gate = deferred();
    let callCount = 0;

    fakeApi.tasks.update = async (id, body) => {
      callCount++;
      if (callCount === 1) {
        await gate.promise;
        return originalUpdate(id, { completed: true });
      }
      return originalUpdate(id, body);
    };

    try {
      const checkbox = screen.getByRole("checkbox", {
        name: 'Mark "Stale Task" as completed',
      });

      // User checks (moves to Completed)
      fireEvent.click(checkbox);
      expect(screen.queryByText("Stale Task")).toBeNull();

      // In Completed, user unchecks (moves back to Active)
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      const completedCheckbox = screen.getByRole("checkbox", {
        name: 'Mark "Stale Task" as active',
      });
      fireEvent.click(completedCheckbox);
      expect(screen.queryByText("Stale Task")).toBeNull();

      // Release server response that says completed: true
      gate.resolve();

      // Switch to Active: task must remain active and unchecked, not forced back to completed
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => {
        const activeCb = screen.getByRole("checkbox", {
          name: 'Mark "Stale Task" as completed',
        });
        expect(activeCb.checked).toBe(false);
      });
    } finally {
      fakeApi.tasks.update = originalUpdate;
    }
  });
});

describe("Active/Completed cache preservation across task mutations", () => {
  it(
    "keeps Active and Completed queries warm, avoids duplicate/missing tasks, and switches responsively",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-1",
            title: "Toggle Me",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [],
          },
          {
            id: "t-2",
            title: "Already Completed",
            description: "",
            completed: true,
            listId: "l1",
            createdAt: 1700000001000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      await boot();
      // 1. Active view loads
      await waitFor(() => expect(screen.getByText("Toggle Me")).toBeTruthy());

      // Switch to Completed to warm Completed cache
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      await waitFor(() => expect(screen.getByText("Already Completed")).toBeTruthy());

      // Switch back to Active (List A)
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => expect(screen.getByText("Toggle Me")).toBeTruthy());

      // Complete "Toggle Me"
      const checkbox = screen.getByRole("checkbox", {
        name: 'Mark "Toggle Me" as completed',
      });
      fireEvent.click(checkbox);

      // Wait for completion to reconcile
      await waitFor(() => expect(screen.queryByText("Toggle Me")).toBeNull());

      // Now gate tasks.get to prove navigation uses warm cache without waiting
      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();

      fakeApi.tasks.get = async (...args) => {
        await delayedGetGate.promise;
        return originalGet(...args);
      };

      try {
        // 3. Switch to Completed — should appear immediately from cache
        fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));

        // Both "Toggle Me" and "Already Completed" appear instantly from reconciled cache!
        expect(screen.getByText("Toggle Me")).toBeTruthy();
        expect(screen.getByText("Already Completed")).toBeTruthy();
        expect(screen.queryByText("Loading your tasks…")).toBeNull();

        // Release background revalidation
        delayedGetGate.resolve();
        await waitFor(() => expect(screen.getByText("Toggle Me")).toBeTruthy());

        // 4. Uncomplete "Toggle Me" from Completed view
        const uncompleteCheckbox = screen.getByRole("checkbox", {
          name: 'Mark "Toggle Me" as active',
        });
        fireEvent.click(uncompleteCheckbox);

        await waitFor(() => expect(screen.queryByText("Toggle Me")).toBeNull());
        expect(screen.getByText("Already Completed")).toBeTruthy();

        // 5. Switch back to Active — "Toggle Me" is in Active immediately!
        fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
        expect(screen.getByText("Toggle Me")).toBeTruthy();
        expect(screen.queryByText("Already Completed")).toBeNull();
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "rapid list switching cannot be replaced by an older response",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-a1",
            title: "Work Item",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [],
          },
          {
            id: "t-b1",
            title: "Personal Item",
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
      await waitFor(() => expect(screen.getByText("Work Item")).toBeTruthy());

      const originalGet = fakeApi.tasks.get;
      const slowGate = deferred();
      let personalCallCount = 0;

      fakeApi.tasks.get = async (query, signal) => {
        if (query?.listId === listBId()) {
          personalCallCount++;
          await slowGate.promise;
        }
        return originalGet(query, signal);
      };

      try {
        // Rapid switch: List B, then immediately back to List A
        fireEvent.click(screen.getByRole("button", { name: LIST_B_NAME }));
        fireEvent.click(screen.getByRole("button", { name: LIST_A_NAME }));

        // List A displays immediately
        expect(screen.getByText("Work Item")).toBeTruthy();

        // Release slow response for List B
        slowGate.resolve();

        // Work Item remains rendered; Personal Item never overwrites it
        await waitFor(() => expect(personalCallCount).toBeGreaterThan(0));
        expect(screen.getByText("Work Item")).toBeTruthy();
        expect(screen.queryByText("Personal Item")).toBeNull();
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );
});

describe("Query-aware cache reconciliation — search, sort, and list isolation", () => {
  it(
    "Test A — Search-cache isolation: unrelated completed task never enters cached search results",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-tax",
            title: "Tax Return",
            description: "",
            completed: true,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [],
          },
          {
            id: "t-groc",
            title: "Buy Groceries",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000001000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      await boot("/completed");
      await waitFor(() => expect(screen.getByText("Tax Return")).toBeTruthy());

      // Open search and search for "tax" on Completed
      fireEvent.click(await screen.findByRole("button", { name: "Open search" }));
      const searchInput = await screen.findByLabelText("Search tasks");
      fireEvent.change(searchInput, { target: { value: "tax" } });

      await waitFor(() => {
        expect(lastTaskQuery.value.q).toBe("tax");
        expect(screen.getByText("Tax Return")).toBeTruthy();
      });

      // Switch to Active tasks (Inbox)
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => expect(screen.getByText("Buy Groceries")).toBeTruthy());

      // Complete "Buy Groceries" from Inbox
      const checkbox = screen.getByRole("checkbox", {
        name: 'Mark "Buy Groceries" as completed',
      });
      fireEvent.click(checkbox);
      await waitFor(() => expect(screen.queryByText("Buy Groceries")).toBeNull());

      // Switch back to Completed view
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      await waitFor(() => expect(screen.getByText("Tax Return")).toBeTruthy());

      // Open search on Completed and gate tasks.get
      fireEvent.click(await screen.findByRole("button", { name: "Open search" }));
      const searchInput2 = await screen.findByLabelText("Search tasks");

      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();

      fakeApi.tasks.get = async (query, signal) => {
        lastTaskQuery.value = query;
        await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        fireEvent.change(searchInput2, { target: { value: "tax" } });
        await waitFor(() => expect(lastTaskQuery.value?.q).toBe("tax"));

        // "Buy Groceries" must NEVER appear in the rendered search results,
        // even before delayed get resolves
        expect(screen.queryByText("Buy Groceries")).toBeNull();

        delayedGetGate.resolve();
        await waitFor(() => expect(screen.getByText("Tax Return")).toBeTruthy());
        expect(screen.queryByText("Buy Groceries")).toBeNull();
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Test B — Sorted-cache correctness: non-default sorted query is not corrupted by unproven insertions",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-old",
            title: "Oldest Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [],
          },
          {
            id: "t-mid",
            title: "Middle Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000001000,
            checklist: [],
          },
          {
            id: "t-done",
            title: "Finished Task",
            description: "",
            completed: true,
            listId: "l1",
            createdAt: 1700000002000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      await boot();
      await waitFor(() => expect(screen.getByText("Oldest Task")).toBeTruthy());

      // Switch to Oldest sort on Active view
      fireEvent.click(screen.getByRole("button", { name: "Oldest" }));
      await waitFor(() => expect(lastTaskQuery.value.sort).toBe("oldest"));
      await waitFor(() => expect(screen.getByText("Oldest Task")).toBeTruthy());

      // Switch to Completed
      fireEvent.click(screen.getByRole("link", { name: "Completed tasks" }));
      await waitFor(() => expect(lastTaskQuery.value.completed).toBe(true));
      await waitFor(() => expect(screen.getByText("Finished Task")).toBeTruthy());

      // Uncomplete "Finished Task"
      const uncompleteCheckbox = screen.getByRole("checkbox", {
        name: 'Mark "Finished Task" as active',
      });
      fireEvent.click(uncompleteCheckbox);
      await waitFor(() => expect(screen.queryByText("Finished Task")).toBeNull());

      // Switch to Active tasks (defaults to newest on initial view load)
      fireEvent.click(screen.getByRole("link", { name: "Active tasks" }));
      await waitFor(() => expect(screen.getByText("Finished Task")).toBeTruthy());

      // Now gate tasks.get and switch sort to "Oldest"
      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();

      fakeApi.tasks.get = async (...args) => {
        await delayedGetGate.promise;
        return originalGet(...args);
      };

      try {
        fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

        // Because "oldest" sort cache was evicted to avoid corrupt order,
        // it treats the query as uncached/loading
        expect(screen.getByText("Loading your tasks…")).toBeTruthy();

        delayedGetGate.resolve();
        await waitFor(() => expect(screen.queryByText("Loading your tasks…")).toBeNull());
        expect(screen.getByText("Oldest Task")).toBeTruthy();
        expect(screen.getByText("Finished Task")).toBeTruthy();
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Test C — Moving tasks between lists: task is removed from source list cache and appears in destination",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-move",
            title: "Task To Move",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000000000,
            checklist: [],
          },
          {
            id: "t-b",
            title: "Existing Personal Task",
            description: "",
            completed: false,
            listId: "l2",
            createdAt: 1700000001000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      let hookRef;
      function TestHarness() {
        const data = useAppData();
        hookRef = data;
        return (
          <div>
            <div>Status: {data.status}</div>
            <button
              onClick={() =>
                data.setTaskQuery({
                  listId: listAId(),
                  completed: false,
                  sort: "newest",
                })
              }
            >
              Go Work
            </button>
            <button
              onClick={() =>
                data.setTaskQuery({
                  listId: listBId(),
                  completed: false,
                  sort: "newest",
                })
              }
            >
              Go Personal
            </button>
            <div data-testid="task-container">
              {data.tasks.map((t) => (
                <div key={t.id} data-testid="task-title">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        );
      }

      render(
        <ThemeProvider>
          <TestHarness />
        </ThemeProvider>,
      );

      // Wait for app status to become "ready"
      await waitFor(() => expect(hookRef?.status).toBe("ready"));

      // Load List A
      fireEvent.click(screen.getByText("Go Work"));
      await waitFor(() => expect(screen.getByText("Task To Move")).toBeTruthy());

      // Load List B to warm its cache
      fireEvent.click(screen.getByText("Go Personal"));
      await waitFor(() => expect(screen.getByText("Existing Personal Task")).toBeTruthy());

      // Return to List A (warm cache)
      fireEvent.click(screen.getByText("Go Work"));
      await waitFor(() => expect(screen.getByText("Task To Move")).toBeTruthy());

      // Move "Task To Move" from List A to List B using the migrated task's real id
      const taskToMove = hookRef.tasks.find((t) => t.title === "Task To Move");
      expect(taskToMove).toBeDefined();

      // Gate tasks.get before editing to test behavior while background fetch is pending
      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();

      fakeApi.tasks.get = async (query, signal) => {
        await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        const moveSuccess = await hookRef.taskActions.editTask(taskToMove.id, {
          listId: listBId(),
        });
        expect(moveSuccess).toBe(true);

        // While fetch is pending, List A must NOT contain "Task To Move"
        await waitFor(() => expect(screen.queryByText("Task To Move")).toBeNull());

        // Switch to List B: "Task To Move" appears in List B without duplicate
        fireEvent.click(screen.getByText("Go Personal"));
        expect(screen.getByText("Task To Move")).toBeTruthy();
        expect(screen.getByText("Existing Personal Task")).toBeTruthy();
        const personalTasks = screen.getAllByText("Task To Move");
        expect(personalTasks).toHaveLength(1);

        // Switch back to List A: still NOT in List A
        fireEvent.click(screen.getByText("Go Work"));
        expect(screen.queryByText("Task To Move")).toBeNull();

        // Release fetch
        delayedGetGate.resolve();
        await waitFor(() => expect(lastTaskQuery.value.listId).toBe(listAId()));
        expect(screen.queryByText("Task To Move")).toBeNull();
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Newest-sort Test A — Newly created task in cached newest-sorted Active view appears at the top without duplicates",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-1",
            title: "Existing Task 1",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000002000,
            checklist: [],
          },
          {
            id: "t-2",
            title: "Existing Task 2",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000001000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();
      let gateActive = false;

      fakeApi.tasks.get = async (query = {}, signal) => {
        if (gateActive) await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        let hookRef;
        function TestHarness() {
          const data = useAppData();
          hookRef = data;
          return (
            <div>
              <div>Status: {data.status}</div>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listAId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Work
              </button>
              <div data-testid="task-container">
                {data.tasks.map((t) => (
                  <div key={t.id} data-testid="task-title">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        render(
          <ThemeProvider>
            <TestHarness />
          </ThemeProvider>,
        );

        await waitFor(() => expect(hookRef?.status).toBe("ready"));
        fireEvent.click(screen.getByText("Go Work"));
        await waitFor(() => expect(screen.getByText("Existing Task 1")).toBeTruthy());

        gateActive = true;

        const added = await hookRef.taskActions.addTask(
          "Brand New Top Task",
          "",
          [],
          listAId()
        );
        expect(added).toBe(true);

        // Before delayed get resolves, the task is immediately at the top of the newest list
        await waitFor(() => {
          const titlesBefore = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesBefore[0]).toBe("Brand New Top Task");
          expect(titlesBefore).toEqual([
            "Brand New Top Task",
            "Existing Task 1",
            "Existing Task 2",
          ]);
        });

        delayedGetGate.resolve();
        await waitFor(() => {
          const titlesAfter = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesAfter).toEqual([
            "Brand New Top Task",
            "Existing Task 1",
            "Existing Task 2",
          ]);
        });
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Newest-sort Test B — Uncompleting an older task places it in the correct chronological position in Active view",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-new",
            title: "Newest Active Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000003000,
            checklist: [],
          },
          {
            id: "t-old",
            title: "Oldest Active Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000001000,
            checklist: [],
          },
          {
            id: "t-mid",
            title: "Middle Completed Task",
            description: "",
            completed: true,
            listId: "l1",
            createdAt: 1700000002000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();
      let gateActive = false;

      fakeApi.tasks.get = async (query = {}, signal) => {
        if (gateActive) await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        let hookRef;
        function TestHarness() {
          const data = useAppData();
          hookRef = data;
          return (
            <div>
              <div>Status: {data.status}</div>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listAId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Active
              </button>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    completed: true,
                    sort: "newest",
                  })
                }
              >
                Go Completed
              </button>
              <div data-testid="task-container">
                {data.tasks.map((t) => (
                  <div key={t.id} data-testid="task-title">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        render(
          <ThemeProvider>
            <TestHarness />
          </ThemeProvider>,
        );

        await waitFor(() => expect(hookRef?.status).toBe("ready"));

        // Warm Active view cache
        fireEvent.click(screen.getByText("Go Active"));
        await waitFor(() => expect(screen.getByText("Newest Active Task")).toBeTruthy());

        // Warm Completed view cache
        fireEvent.click(screen.getByText("Go Completed"));
        await waitFor(() => expect(screen.getByText("Middle Completed Task")).toBeTruthy());

        const middleTask = hookRef.tasks.find((t) => t.title === "Middle Completed Task");
        expect(middleTask).toBeDefined();

        gateActive = true;

        // Uncomplete middleTask
        const toggled = await hookRef.taskActions.toggleTask(middleTask.id);
        expect(toggled).toBe(true);

        // Switch back to Active view while get is delayed
        fireEvent.click(screen.getByText("Go Active"));

        // In Active view, Middle Completed Task must be placed chronologically
        // between Newest Active Task and Oldest Active Task (NOT at index 0)
        const titles = screen
          .getAllByTestId("task-title")
          .map((el) => el.textContent);
        expect(titles).toEqual([
          "Newest Active Task",
          "Middle Completed Task",
          "Oldest Active Task",
        ]);

        delayedGetGate.resolve();
        await waitFor(() => {
          const titlesAfter = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesAfter).toEqual([
            "Newest Active Task",
            "Middle Completed Task",
            "Oldest Active Task",
          ]);
        });
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Newest-sort Test C — Moving an older task between lists places it at correct position in destination view and removes from source",
    async () => {
      seed({
        taskRows: [
          {
            id: "t-move",
            title: "Task To Move (Middle Age)",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1700000002000,
            checklist: [],
          },
          {
            id: "t-b-new",
            title: "Newer Personal Task",
            description: "",
            completed: false,
            listId: "l2",
            createdAt: 1700000003000,
            checklist: [],
          },
          {
            id: "t-b-old",
            title: "Older Personal Task",
            description: "",
            completed: false,
            listId: "l2",
            createdAt: 1700000001000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();
      let gateActive = false;

      fakeApi.tasks.get = async (query = {}, signal) => {
        if (gateActive) await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        let hookRef;
        function TestHarness() {
          const data = useAppData();
          hookRef = data;
          return (
            <div>
              <div>Status: {data.status}</div>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listAId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Work
              </button>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listBId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Personal
              </button>
              <div data-testid="task-container">
                {data.tasks.map((t) => (
                  <div key={t.id} data-testid="task-title">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        render(
          <ThemeProvider>
            <TestHarness />
          </ThemeProvider>,
        );

        await waitFor(() => expect(hookRef?.status).toBe("ready"));

        // Warm List A
        fireEvent.click(screen.getByText("Go Work"));
        await waitFor(() => expect(screen.getByText("Task To Move (Middle Age)")).toBeTruthy());

        // Warm List B
        fireEvent.click(screen.getByText("Go Personal"));
        await waitFor(() => expect(screen.getByText("Newer Personal Task")).toBeTruthy());

        // Return to List A
        fireEvent.click(screen.getByText("Go Work"));
        await waitFor(() => expect(screen.getByText("Task To Move (Middle Age)")).toBeTruthy());

        const taskToMove = hookRef.tasks.find((t) => t.title === "Task To Move (Middle Age)");
        expect(taskToMove).toBeDefined();

        gateActive = true;

        const moved = await hookRef.taskActions.editTask(taskToMove.id, {
          listId: listBId(),
        });
        expect(moved).toBe(true);

        // While get is delayed:
        // List A must NOT contain the moved task
        await waitFor(() => expect(screen.queryByText("Task To Move (Middle Age)")).toBeNull());

        // Switch to List B: "Task To Move (Middle Age)" is placed chronologically
        // between Newer Personal Task and Older Personal Task
        fireEvent.click(screen.getByText("Go Personal"));
        const titles = screen
          .getAllByTestId("task-title")
          .map((el) => el.textContent);
        expect(titles).toEqual([
          "Newer Personal Task",
          "Task To Move (Middle Age)",
          "Older Personal Task",
        ]);

        // Release delayed get
        delayedGetGate.resolve();
        await waitFor(() => {
          const titlesAfter = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesAfter).toEqual([
            "Newer Personal Task",
            "Task To Move (Middle Age)",
            "Older Personal Task",
          ]);
        });
      } finally {
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Newest-sort Test D — Inserting a same-timestamp task into a warm newest cache orders by descending ID before and after revalidation",
    async () => {
      seed({
        taskRows: [
          {
            id: "task-10",
            title: "Task 10 (Lower ID)",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1777636800000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      const originalCreate = fakeApi.tasks.create;
      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();
      let gateActive = false;

      fakeApi.tasks.get = async (query = {}, signal) => {
        if (gateActive) await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        let hookRef;
        function TestHarness() {
          const data = useAppData();
          hookRef = data;
          return (
            <div>
              <div>Status: {data.status}</div>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listAId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Work
              </button>
              <div data-testid="task-container">
                {data.tasks.map((t) => (
                  <div key={t.id} data-testid="task-title">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        render(
          <ThemeProvider>
            <TestHarness />
          </ThemeProvider>,
        );

        await waitFor(() => expect(hookRef?.status).toBe("ready"));
        fireEvent.click(screen.getByText("Go Work"));
        await waitFor(() => expect(screen.getByText("Task 10 (Lower ID)")).toBeTruthy());

        fakeApi.tasks.create = async (body) => {
          const item = {
            id: "task-20", // Higher ID with exact same createdAt
            title: body.title,
            description: body.description ?? "",
            completed: false,
            listId: body.listId,
            createdAt: 1777636800000,
            checklist: [],
          };
          db.tasks.push(item);
          return item;
        };

        gateActive = true;
        const created = await hookRef.taskActions.addTask(
          "Task 20 (Higher ID)",
          "",
          [],
          listAId()
        );
        expect(created).toBe(true);

        // Optimistic cache check: task-20 has larger ID, so with same createdAt it MUST appear at index 0 (id DESC)
        await waitFor(() => {
          const titlesOptimistic = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesOptimistic).toEqual([
            "Task 20 (Higher ID)",
            "Task 10 (Lower ID)",
          ]);
        });

        // Release delayed revalidation
        delayedGetGate.resolve();
        await waitFor(() => {
          const titlesAuthoritative = screen
            .getAllByTestId("task-title")
            .map((el) => el.textContent);
          expect(titlesAuthoritative).toEqual([
            "Task 20 (Higher ID)",
            "Task 10 (Lower ID)",
          ]);
        });
      } finally {
        fakeApi.tasks.create = originalCreate;
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );

  it(
    "Newest-sort Test E — Unreliable timestamp on task creation invalidates cache and restores authoritative server order",
    async () => {
      seed({
        taskRows: [
          {
            id: "task-valid",
            title: "Valid Existing Task",
            description: "",
            completed: false,
            listId: "l1",
            createdAt: 1777636800000,
            checklist: [],
          },
        ],
        selectedList: "l1",
      });

      const originalCreate = fakeApi.tasks.create;
      const originalGet = fakeApi.tasks.get;
      const delayedGetGate = deferred();
      let gateActive = false;

      fakeApi.tasks.get = async (query = {}, signal) => {
        if (gateActive) await delayedGetGate.promise;
        return originalGet(query, signal);
      };

      try {
        let hookRef;
        function TestHarness() {
          const data = useAppData();
          hookRef = data;
          return (
            <div>
              <div>Status: {data.status}</div>
              <button
                onClick={() =>
                  data.setTaskQuery({
                    listId: listAId(),
                    completed: false,
                    sort: "newest",
                  })
                }
              >
                Go Work
              </button>
              <div data-testid="task-container">
                {data.tasks.map((t) => (
                  <div key={t.id} data-testid="task-title">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        render(
          <ThemeProvider>
            <TestHarness />
          </ThemeProvider>,
        );

        await waitFor(() => expect(hookRef?.status).toBe("ready"));
        fireEvent.click(screen.getByText("Go Work"));
        await waitFor(() => expect(screen.getByText("Valid Existing Task")).toBeTruthy());

        fakeApi.tasks.create = async (body) => {
          const item = {
            id: "task-invalid",
            title: body.title,
            description: "",
            completed: false,
            listId: body.listId,
            createdAt: "unparseable-timestamp", // Unreliable timestamp
            checklist: [],
          };
          db.tasks.push(item);
          return item;
        };

        gateActive = true;
        const created = await hookRef.taskActions.addTask(
          "Task Invalid Timestamp",
          "",
          [],
          listAId()
        );
        expect(created).toBe(true);

        // Because timestamp is unreliable, insertOrUpdateNewest returns null and evicts the cache entry.
        // Release revalidation:
        delayedGetGate.resolve();
        await waitFor(() => {
          expect(screen.getByText("Task Invalid Timestamp")).toBeTruthy();
          expect(screen.getByText("Valid Existing Task")).toBeTruthy();
        });
      } finally {
        fakeApi.tasks.create = originalCreate;
        fakeApi.tasks.get = originalGet;
      }
    },
    15000
  );
});

describe("fakeApi sort contract and chronological query ordering", () => {
  it("directly verifies fakeApi.tasks.get newest and oldest sort contracts with ISO and numeric timestamps", async () => {
    reset();
    db.tasks.length = 0;
    db.tasks.push(
      { id: "t-old", title: "Old Task", completed: false, listId: "inbox", createdAt: "2026-01-01T00:00:00.000Z", checklist: [] },
      { id: "t-mid", title: "Mid Task", completed: false, listId: "inbox", createdAt: 1767312000000, checklist: [] },
      { id: "t-equal", title: "Equal Task", completed: false, listId: "inbox", createdAt: 1767312000000, checklist: [] },
      { id: "t-new", title: "New Task", completed: false, listId: "inbox", createdAt: "2026-01-03T00:00:00.000Z", checklist: [] },
    );

    // 1. sort="newest": newest createdAt first, then id DESC tie-breaker
    // t-mid ("t-mid") > t-equal ("t-equal"), so t-mid comes before t-equal
    const newestRows = await fakeApi.tasks.get({ sort: "newest" });
    expect(newestRows.map((t) => t.id)).toEqual(["t-new", "t-mid", "t-equal", "t-old"]);

    // 2. default (no sort param): defaults to newest first
    const defaultRows = await fakeApi.tasks.get({});
    expect(defaultRows.map((t) => t.id)).toEqual(["t-new", "t-mid", "t-equal", "t-old"]);

    // 3. sort="oldest": oldest createdAt first, then id ASC tie-breaker
    // For id ASC: t-equal ("t-equal") < t-mid ("t-mid"), so t-equal comes before t-mid
    const oldestRows = await fakeApi.tasks.get({ sort: "oldest" });
    expect(oldestRows.map((t) => t.id)).toEqual(["t-old", "t-equal", "t-mid", "t-new"]);
  });

  it("verifies fakeApi.tasks.get az and za sort contracts with case-insensitivity and tie-breakers", async () => {
    reset();
    db.tasks.length = 0;
    db.tasks.push(
      { id: "t-b1", title: "banana", completed: false, listId: "inbox", createdAt: 1000, checklist: [] },
      { id: "t-a", title: "Apple", completed: false, listId: "inbox", createdAt: 2000, checklist: [] },
      { id: "t-c", title: "cherry", completed: false, listId: "inbox", createdAt: 3000, checklist: [] },
      { id: "t-b2", title: "Banana", completed: false, listId: "inbox", createdAt: 1500, checklist: [] },
      { id: "t-b3", title: "BANANA", completed: false, listId: "inbox", createdAt: 1500, checklist: [] },
    );

    // az: title ascending case-insensitive, then createdAt ASC, then id ASC
    // titles: Apple (a), banana (b), cherry (c)
    // For "banana" / "Banana" / "BANANA":
    // t-b1: createdAt 1000
    // t-b2: createdAt 1500, id "t-b2"
    // t-b3: createdAt 1500, id "t-b3" ("t-b2" < "t-b3" -> id ASC)
    const azRows = await fakeApi.tasks.get({ sort: "az" });
    expect(azRows.map((t) => t.id)).toEqual(["t-a", "t-b1", "t-b2", "t-b3", "t-c"]);

    // za: title descending case-insensitive, then createdAt ASC, then id ASC
    // titles: cherry (c), banana (b), Apple (a)
    // For equal titles: tie-breaker is createdAt ASC, id ASC
    const zaRows = await fakeApi.tasks.get({ sort: "za" });
    expect(zaRows.map((t) => t.id)).toEqual(["t-c", "t-b1", "t-b2", "t-b3", "t-a"]);
  });
});

describe("insertOrUpdateNewest chronological insertion", () => {
  it("inserts into an empty list", () => {
    const task = { id: "1", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(insertOrUpdateNewest([], task)).toEqual([task]);
  });

  it("inserts at index 0 when newer than all existing tasks", () => {
    const older = { id: "1", createdAt: "2026-01-01T00:00:00.000Z" };
    const newer = { id: "2", createdAt: "2026-01-02T00:00:00.000Z" };
    expect(insertOrUpdateNewest([older], newer)).toEqual([newer, older]);
  });

  it("inserts at the end when older than all existing tasks", () => {
    const newer = { id: "1", createdAt: "2026-01-03T00:00:00.000Z" };
    const older = { id: "2", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(insertOrUpdateNewest([newer], older)).toEqual([newer, older]);
  });

  it("inserts in the middle at exact chronological position", () => {
    const taskNewest = { id: "1", createdAt: "2026-01-03T00:00:00.000Z" };
    const taskOldest = { id: "3", createdAt: "2026-01-01T00:00:00.000Z" };
    const taskMiddle = { id: "2", createdAt: "2026-01-02T00:00:00.000Z" };

    const result = insertOrUpdateNewest([taskNewest, taskOldest], taskMiddle);
    expect(result).toEqual([taskNewest, taskMiddle, taskOldest]);
  });

  it("breaks ties with descending ID when timestamps are identical (backend contract: createdAt DESC, id DESC)", () => {
    const t30 = { id: "task-30", createdAt: "2026-01-01T12:00:00.000Z" };
    const t10 = { id: "task-10", createdAt: "2026-01-01T12:00:00.000Z" };
    const existing = [t30, t10];

    // 1. Insert intermediate ID "task-20" -> placed between "task-30" and "task-10"
    const t20 = { id: "task-20", createdAt: "2026-01-01T12:00:00.000Z" };
    const res1 = insertOrUpdateNewest(existing, t20);
    expect(res1.map((t) => t.id)).toEqual(["task-30", "task-20", "task-10"]);

    // 2. Insert larger ID "task-40" -> placed at index 0
    const t40 = { id: "task-40", createdAt: "2026-01-01T12:00:00.000Z" };
    const res2 = insertOrUpdateNewest(existing, t40);
    expect(res2.map((t) => t.id)).toEqual(["task-40", "task-30", "task-10"]);

    // 3. Insert smaller ID "task-05" -> placed at end
    const t05 = { id: "task-05", createdAt: "2026-01-01T12:00:00.000Z" };
    const res3 = insertOrUpdateNewest(existing, t05);
    expect(res3.map((t) => t.id)).toEqual(["task-30", "task-10", "task-05"]);
  });

  it("updates existing task in place without duplicating or changing order", () => {
    const t1 = { id: "task-20", title: "A", createdAt: "2026-01-01T12:00:00.000Z" };
    const t2 = { id: "task-10", title: "B", createdAt: "2026-01-01T12:00:00.000Z" };
    const updatedT2 = { id: "task-10", title: "B Updated", createdAt: "2026-01-01T12:00:00.000Z" };

    const result = insertOrUpdateNewest([t1, t2], updatedT2);
    expect(result).toHaveLength(2);
    expect(result[1].title).toBe("B Updated");
    expect(result[0].id).toBe("task-20");
    expect(result[1].id).toBe("task-10");
  });

  it("returns null if timestamp or id cannot be compared reliably", () => {
    const valid = { id: "1", createdAt: "2026-01-01T00:00:00.000Z" };

    // Invalid timestamp on new task
    expect(insertOrUpdateNewest([valid], { id: "2", createdAt: "not-a-date" })).toBeNull();
    expect(insertOrUpdateNewest([valid], { id: "2", createdAt: null })).toBeNull();

    // Invalid identifier on new task
    expect(insertOrUpdateNewest([valid], { id: "", createdAt: "2026-01-02T00:00:00.000Z" })).toBeNull();
    expect(insertOrUpdateNewest([valid], { id: null, createdAt: "2026-01-02T00:00:00.000Z" })).toBeNull();

    // Unreliable element in list
    const corrupted = { id: "bad", createdAt: "unparseable" };
    expect(insertOrUpdateNewest([corrupted], { id: "2", createdAt: "2026-01-02T00:00:00.000Z" })).toBeNull();
  });

  it("handles numeric timestamps and ISO strings seamlessly without subtraction", () => {
    const t1 = { id: "1", createdAt: 1700000003000 };
    const t3 = { id: "3", createdAt: "2023-11-14T22:13:21.000Z" }; // 1700000001000
    const t2 = { id: "2", createdAt: 1700000002000 };

    const result = insertOrUpdateNewest([t1, t3], t2);
    expect(result.map((t) => t.id)).toEqual(["1", "2", "3"]);
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
