import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TaskItem from "./TaskItem.jsx";

const taskActions = {
  toggleTask: vi.fn(),
  editTask: vi.fn(),
  deleteTask: vi.fn(),
  addChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
  toggleChecklistItem: vi.fn(),
};

function makeTask(overrides = {}) {
  return {
    id: "t1",
    title: "Malformed task",
    description: "",
    completed: false,
    listId: "l1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    checklist: [],
    ...overrides,
  };
}

function renderTask(task, editingId = null) {
  return render(
    <TaskItem
      task={task}
      taskActions={taskActions}
      editingId={editingId}
      onStartEdit={vi.fn()}
    />,
  );
}

describe("TaskItem description rendering", () => {
  it("renders a malformed array description as empty instead of crashing", () => {
    // Objects are not valid React children — this used to throw.
    renderTask(makeTask({ description: [{ id: "c1", text: "legacy note" }] }));

    expect(screen.getByText("Malformed task")).toBeTruthy();
    expect(screen.queryByRole("paragraph")).toBeNull();
    expect(screen.queryByText("legacy note")).toBeNull();
  });

  it("renders a malformed object description as empty instead of crashing", () => {
    renderTask(makeTask({ description: { id: "c1", text: "legacy note" } }));

    expect(screen.getByText("Malformed task")).toBeTruthy();
    expect(screen.queryByRole("paragraph")).toBeNull();
  });

  it("still renders a normal string description", () => {
    renderTask(makeTask({ description: "a real description" }));

    expect(screen.getByRole("paragraph").textContent).toBe("a real description");
  });

  it("renders no description paragraph when it is null", () => {
    renderTask(makeTask({ description: null }));

    expect(screen.getByText("Malformed task")).toBeTruthy();
    expect(screen.queryByRole("paragraph")).toBeNull();
  });

  it("edits a malformed description as an empty field", () => {
    const task = makeTask({ description: ["not", "a", "string"] });
    const { rerender } = renderTask(task);

    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    // editingId is parent-owned, so re-render the way the app would.
    rerender(
      <TaskItem
        task={task}
        taskActions={taskActions}
        editingId={task.id}
        onStartEdit={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText("Description (optional)").value,
    ).toBe("");
  });
});
