import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { calls, db, fakeApi, lastTaskQuery, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

const WORK_NAME = "Work";

function seed({ taskRows = [], selectedList = "l1" } = {}) {
  localStorage.setItem(
    "todo-app-lists",
    JSON.stringify([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "l1", name: WORK_NAME, icon: "briefcase" },
    ]),
  );
  localStorage.setItem("todo-app-tasks", JSON.stringify(taskRows));
  localStorage.setItem("todo-app-selected-list", JSON.stringify(selectedList));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
  reset();
}

function seedTask(overrides = {}) {
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

async function boot(path = "/") {
  window.history.replaceState({}, "", path);
  render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
  // Migration verification also calls GET /tasks (with no params); the page's
  // query is the one that carries a sort, so waiting for it proves readiness.
  await waitFor(() => expect(lastTaskQuery.value?.sort).toBeDefined());
}

const workId = () => db.lists.find((list) => list.name === WORK_NAME).id;

function taskTitles() {
  return screen.getAllByRole("checkbox").map((box) => {
    const label = box.getAttribute("aria-label") ?? "";
    return label.replace(/^Mark "(.+)" as (?:completed|active)$/, "$1");
  });
}

async function openSearch() {
  fireEvent.click(await screen.findByRole("button", { name: "Open search" }));
  await screen.findByLabelText("Search tasks");
}

async function typeSearch(value) {
  fireEvent.change(await screen.findByLabelText("Search tasks"), {
    target: { value },
  });
}

async function waitForQuery(match) {
  await waitFor(() => expect(lastTaskQuery.value).toMatchObject(match));
}

describe("Inbox query construction", () => {
  it("sends listId and completed=false when there is no search", async () => {
    seed();

    await boot();

    await waitForQuery({
      listId: workId(),
      completed: false,
      sort: "newest",
    });
    expect(lastTaskQuery.value).not.toHaveProperty("q");
  });

  it("drops listId while searching so results are global", async () => {
    seed();
    await boot();

    await openSearch();
    await typeSearch("needle");

    await waitForQuery({ completed: false, q: "needle", sort: "newest" });
    expect(lastTaskQuery.value).not.toHaveProperty("listId");
  });

  it("trims the search query", async () => {
    seed();
    await boot();

    await openSearch();
    await typeSearch("   needle   ");

    await waitForQuery({ q: "needle" });
    expect(lastTaskQuery.value.q).toBe("needle");
  });

  it("includes the selected sort", async () => {
    seed();
    await boot();
    await waitForQuery({ sort: "newest" });

    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

    await waitForQuery({ sort: "oldest", completed: false });
  });
});

describe("Completed query construction", () => {
  it("always sends completed=true and never a listId", async () => {
    seed();

    await boot("/completed");

    await waitForQuery({ completed: true, sort: "newest" });
    expect(lastTaskQuery.value).not.toHaveProperty("listId");
    expect(lastTaskQuery.value).not.toHaveProperty("q");
  });

  it("searches globally on the Completed page", async () => {
    seed();
    await boot("/completed");

    await openSearch();
    await typeSearch("needle");

    await waitForQuery({ completed: true, q: "needle" });
    expect(lastTaskQuery.value).not.toHaveProperty("listId");
  });

  it("includes the selected sort", async () => {
    seed();
    await boot("/completed");
    await waitForQuery({ completed: true });

    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

    await waitForQuery({ completed: true, sort: "oldest" });
  });
});

describe("server-side search semantics", () => {
  it("matches on the title", async () => {
    seed({
      taskRows: [
        seedTask({ id: "t1", title: "Buy milk" }),
        seedTask({ id: "t2", title: "Unrelated" }),
      ],
    });
    await boot();

    await openSearch();
    await typeSearch("milk");

    await waitFor(() => expect(taskTitles()).toEqual(["Buy milk"]));
  });

  it("matches on the description", async () => {
    seed({
      taskRows: [
        seedTask({ id: "t1", title: "Plain", description: "has NEEDLE inside" }),
        seedTask({ id: "t2", title: "Other", description: "nothing" }),
      ],
    });
    await boot();

    await openSearch();
    await typeSearch("needle");

    await waitFor(() => expect(taskTitles()).toEqual(["Plain"]));
  });

  it("does not match checklist text", async () => {
    seed({
      taskRows: [
        seedTask({
          id: "t1",
          title: "Unrelated title",
          checklist: [{ id: "c1", text: "hiddenneedle", completed: false }],
        }),
      ],
    });
    await boot();

    await openSearch();
    await typeSearch("hiddenneedle");

    await waitForQuery({ q: "hiddenneedle" });
    await waitFor(() =>
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0),
    );
  });

  it("matches case-insensitively", async () => {
    seed({
      taskRows: [seedTask({ id: "t1", title: "Milk Run" })],
    });
    await boot();

    await openSearch();
    await typeSearch("milk run");

    await waitFor(() => expect(taskTitles()).toEqual(["Milk Run"]));
  });

  it("treats a whitespace-only query as no search", async () => {
    seed();
    await boot();
    await waitForQuery({ listId: workId() });

    await openSearch();
    await typeSearch("    ");

    // No q, so list scoping comes back — identical to an empty search.
    await waitFor(() =>
      expect(lastTaskQuery.value).not.toHaveProperty("q"),
    );
    expect(lastTaskQuery.value.listId).toBe(workId());
    expect(lastTaskQuery.value.completed).toBe(false);
  });
});

describe("server ordering is authoritative", () => {
  it("renders the response order exactly, without sorting locally", async () => {
    seed();

    const original = fakeApi.tasks.get;
    const scrambled = [
      {
        id: "t3",
        title: "Third",
        description: "",
        completed: false,
        listId: INBOX_LIST_ID,
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        checklist: [],
      },
      {
        id: "t1",
        title: "First",
        description: "",
        completed: false,
        listId: INBOX_LIST_ID,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        checklist: [],
      },
      {
        id: "t2",
        title: "Second",
        description: "",
        completed: false,
        listId: INBOX_LIST_ID,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        checklist: [],
      },
    ];

    // ISO timestamps in an order no client sort would produce. The first
    // call is migration's conflict check, which must still see an empty
    // server — only later responses carry the scrambled payload.
    let seen = 0;
    fakeApi.tasks.get = async (query = {}) => {
      seen += 1;
      calls.push("tasks.get");
      lastTaskQuery.value = query;
      return seen === 1 ? [] : scrambled;
    };

    try {
      await boot();

      await waitFor(() => expect(taskTitles()).toHaveLength(3));
      expect(taskTitles()).toEqual(["Third", "First", "Second"]);
    } finally {
      fakeApi.tasks.get = original;
    }
  });

  it("never performs numeric subtraction on ISO timestamps", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { cwd } = await import("node:process");

    const offenders = [];

    function walk(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|jsx)$/.test(entry.name)) {
          const source = readFileSync(full, "utf8");
          if (/createdAt\s*[-+]|[-+]\s*\w*\.?createdAt/.test(source)) {
            offenders.push(full);
          }
        }
      }
    }

    walk(join(cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

describe("stale response protection", () => {
  it("cannot be overwritten by a slower older response", async () => {
    seed({
      taskRows: [
        seedTask({ id: "t1", title: "Alpha" }),
        seedTask({ id: "t2", title: "About" }),
        seedTask({ id: "t3", title: "Beta" }),
      ],
    });
    await boot();

    const original = fakeApi.tasks.get;
    fakeApi.tasks.get = async (query, signal) => {
      if (query.q === "a") {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return original(query, signal);
    };

    try {
      await openSearch();

      await typeSearch("a");
      await typeSearch("ab");

      await waitFor(() => expect(taskTitles()).toEqual(["About"]));

      // Give the slow "a" response time to land; it must be discarded.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
      });

      // "a" would match both Alpha and About, "ab" only About — so this
      // proves the older response did not win.
      expect(taskTitles()).toEqual(["About"]);
    } finally {
      fakeApi.tasks.get = original;
    }
  });
});
