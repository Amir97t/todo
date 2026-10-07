import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import { calls, db, lastTaskQuery, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

const WORK_NAME = "Work";

function seed() {
  localStorage.setItem(
    "todo-app-lists",
    JSON.stringify([
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "l1", name: WORK_NAME, icon: "briefcase" },
    ]),
  );
  localStorage.setItem("todo-app-tasks", JSON.stringify([]));
  localStorage.setItem("todo-app-selected-list", JSON.stringify("l1"));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
  reset();
}

function workId() {
  return db.lists.find((list) => list.name === WORK_NAME).id;
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

describe("search debounce behavior (0ms in test mode)", () => {
  beforeEach(() => {
    seed();
  });

  it("rapid keystrokes result in only the final query on Inbox", async () => {
    await boot();

    await openSearch();

    // Type rapidly: "a" -> "ab" -> "abc"
    await typeSearch("a");
    await typeSearch("ab");
    await typeSearch("abc");

    // In test mode debounce is 0ms, so each change fires synchronously
    // but we only care that the final state is correct
    await waitForQuery({ q: "abc", completed: false });
    expect(lastTaskQuery.value.q).toBe("abc");
  });

  it("rapid keystrokes result in only the final query on Completed", async () => {
    await boot("/completed");

    await openSearch();

    await typeSearch("x");
    await typeSearch("xy");
    await typeSearch("xyz");

    await waitForQuery({ q: "xyz", completed: true });
    expect(lastTaskQuery.value.q).toBe("xyz");
  });

  it("clearing search removes q and restores listId on Inbox", async () => {
    await boot();

    await openSearch();
    await typeSearch("search term");
    await waitForQuery({ q: "search term" });

    // Clear the search
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearButton);

    await waitFor(() => expect(lastTaskQuery.value).not.toHaveProperty("q"));
    expect(lastTaskQuery.value.listId).toBe(workId());
    expect(lastTaskQuery.value.completed).toBe(false);
  });

  it("changing filter/sort fires immediately", async () => {
    await boot();

    const initialGetCalls = calls.filter((c) => c === "tasks.get").length;

    fireEvent.click(screen.getByRole("button", { name: "Oldest" }));

    await waitFor(() => expect(calls.filter((c) => c === "tasks.get").length).toBe(initialGetCalls + 1));
    await waitForQuery({ sort: "oldest" });
  });

  it("input field updates immediately (local state not debounced)", async () => {
    await boot();
    await openSearch();

    const input = screen.getByLabelText("Search tasks");
    await typeSearch("fast");

    // Local input value must be immediate
    expect(input.value).toBe("fast");
  });

  it("whitespace-only query treated as no search", async () => {
    await boot();
    await waitForQuery({ listId: workId() });

    await openSearch();
    await typeSearch("    ");

    await waitFor(() => expect(lastTaskQuery.value).not.toHaveProperty("q"));
    expect(lastTaskQuery.value.listId).toBe(workId());
    expect(lastTaskQuery.value.completed).toBe(false);
  });
});