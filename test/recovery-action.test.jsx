import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "../src/components/common/EmptyState.jsx";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

// Malformed legacy data aborts migration instead of being coerced, which is
// what puts the app into its recoverable error state. createdAt is never
// rendered, so it is the safe field to break.
function seedBrokenLegacy() {
  localStorage.setItem(
    "todo-app-lists",
    JSON.stringify([{ id: "inbox", name: "Inbox", icon: "inbox" }]),
  );
  localStorage.setItem(
    "todo-app-tasks",
    JSON.stringify([
      {
        id: "t1",
        title: "broken",
        description: "",
        completed: false,
        listId: "inbox",
        createdAt: "not-a-number",
        checklist: [],
      },
    ]),
  );
  localStorage.setItem("todo-app-selected-list", JSON.stringify("inbox"));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
}

describe("recovery action", () => {
  it("shows the recovery label as visible text while keeping shortcuts icon-only", () => {
    const onAction = vi.fn();

    const { rerender } = render(
      <EmptyState
        title="Could not load your data"
        description="boom"
        actionLabel="Try again"
        onAction={onAction}
        showActionLabel
      />,
    );

    const retry = screen.getByRole("button", { name: "Try again" });
    // Text in the document, not only an accessible name on an icon.
    expect(retry.textContent.trim()).toBe("Try again");
    expect(retry.getAttribute("aria-label")).toBe("Try again");
    expect(retry.getAttribute("title")).toBe("Try again");

    // The unrelated Add-task shortcut keeps its compact icon-only form.
    rerender(
      <EmptyState
        title="No active tasks"
        description="nothing"
        actionLabel="Add task"
        onAction={onAction}
      />,
    );

    const addTask = screen.getByRole("button", { name: "Add task" });
    expect(addTask.textContent.trim()).toBe("");
    expect(addTask.classList.contains("w-fit")).toBe(false);
  });

  it("renders a visibly labelled retry control on the app error state", async () => {
    seedBrokenLegacy();

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );

    const retry = await screen.findByRole("button", { name: "Try again" });

    expect(retry.textContent.trim()).toBe("Try again");
    expect(screen.getByText("Could not load your data")).toBeTruthy();
  });
});
