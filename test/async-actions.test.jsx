import { act } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";

// main.jsx mounts App inside ThemeProvider, which CelestialBackground requires.
function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

const read = (key, fallback) => {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : JSON.parse(raw);
};

const lists = () => read("todo-app-lists", []);
const tasks = () => read("todo-app-tasks", []);
const selected = () => read("todo-app-selected-list", null);

const flush = () => act(async () => {});

function seed({
  listRows = [
    { id: "inbox", name: "Inbox", icon: "inbox" },
    { id: "l1", name: "Work", icon: "briefcase" },
  ],
  taskRows = [],
  selectedList = "inbox",
} = {}) {
  localStorage.setItem("todo-app-lists", JSON.stringify(listRows));
  localStorage.setItem("todo-app-tasks", JSON.stringify(taskRows));
  localStorage.setItem(
    "todo-app-selected-list",
    JSON.stringify(selectedList),
  );
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
}

function taskRow(overrides = {}) {
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

async function openAddTask() {
  fireEvent.click(screen.getByRole("button", { name: "Add new task" }));
  await screen.findByPlaceholderText("Task title...");
}

async function submitTask(title) {
  fireEvent.change(screen.getByPlaceholderText("Task title..."), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Task" }));
  await flush();
}

describe("list actions", () => {
  it("creates a trimmed list and closes the form", async () => {
    seed();

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(screen.getByPlaceholderText("List name..."), {
      target: { value: "   Projects   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(lists().map((row) => row.name)).toContain("Projects"),
    );

    const created = lists().find((row) => row.name === "Projects");
    expect(created.name).toBe("Projects");
    expect(created.id).not.toBe("inbox");
    expect(screen.queryByPlaceholderText("List name...")).toBeNull();
  });

  it("rejects a duplicate name and keeps the form open", async () => {
    seed();
    const before = lists();

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(screen.getByPlaceholderText("List name..."), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await flush();

    expect(lists()).toEqual(before);
    expect(screen.getByPlaceholderText("List name...")).toBeTruthy();
  });

  it("renames a list and leaves edit mode", async () => {
    seed();

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Rename Work" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Design  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(lists().find((row) => row.id === "l1")?.name).toBe("Design"),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps edit mode when a rename is rejected", async () => {
    seed();

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Rename Work" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await flush();

    expect(lists().find((row) => row.id === "l1")?.name).toBe("Work");
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("relocates tasks when deleting a list", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete List" }));

    await waitFor(() =>
      expect(lists().some((row) => row.id === "l1")).toBe(false),
    );
    expect(tasks()).toHaveLength(1);
    expect(tasks()[0].listId).toBe("inbox");
    expect(selected()).toBe("inbox");
  });

  it("removes tasks when deleting a list with its tasks", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete List & Tasks" }),
    );

    await waitFor(() => expect(tasks()).toHaveLength(0));
    expect(lists().some((row) => row.id === "l1")).toBe(false);
  });
});

describe("task actions", () => {
  it("creates a task with the legacy local shape", async () => {
    seed({ selectedList: "l1" });

    renderApp();
    await openAddTask();
    await submitTask("   Ship API   ");

    expect(tasks()).toHaveLength(1);
    const created = tasks()[0];
    expect(created.title).toBe("Ship API");
    expect(created.listId).toBe("l1");
    expect(created.completed).toBe(false);
    expect(typeof created.id).toBe("string");
    // Client-generated epoch milliseconds are still preserved at this step.
    expect(typeof created.createdAt).toBe("number");
    expect(created.checklist).toEqual([]);
  });

  it("does not create a task when the target list does not exist", async () => {
    seed({ selectedList: "missing-list" });

    renderApp();
    await openAddTask();
    await submitTask("Orphan");

    expect(tasks()).toHaveLength(0);
  });

  it("toggles a task", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });

    renderApp();
    fireEvent.click(
      screen.getByRole("checkbox", { name: 'Mark "Ship it" as completed' }),
    );

    await waitFor(() => expect(tasks()[0].completed).toBe(true));
  });

  it("edits a task title", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "  Shipped  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(tasks()[0].title).toBe("Shipped"));
    expect(tasks()[0].completed).toBe(false);
  });

  it("deletes a task", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(tasks()).toHaveLength(0));
  });
});

describe("checklist actions", () => {
  function seedTask(checklist) {
    seed({ taskRows: [taskRow({ checklist })], selectedList: "l1" });
  }

  const baseItems = [
    { id: "c1", text: "Step one", completed: false },
    { id: "c2", text: "Step two", completed: false },
  ];

  const currentChecklist = () => tasks()[0].checklist;

  it("appends a client-generated item without touching existing ids", async () => {
    seedTask(baseItems);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));
    fireEvent.change(screen.getByLabelText("New checklist item"), {
      target: { value: "  Step three  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));

    await waitFor(() => expect(currentChecklist()).toHaveLength(3));

    const rows = currentChecklist();
    expect(rows.map((item) => item.text)).toEqual([
      "Step one",
      "Step two",
      "Step three",
    ]);
    expect(rows[0].id).toBe("c1");
    expect(rows[1].id).toBe("c2");
    expect(rows[2].id).not.toBe("c1");
    expect(rows[2].completed).toBe(false);
  });

  it("toggles a checklist item", async () => {
    seedTask(baseItems);

    renderApp();
    fireEvent.click(
      screen.getByRole("button", { name: 'Mark "Step one" complete' }),
    );

    await waitFor(() => expect(currentChecklist()[0].completed).toBe(true));
    expect(currentChecklist()[1].completed).toBe(false);
  });

  it("edits a checklist item text", async () => {
    seedTask(baseItems);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: 'Edit "Step one"' }));
    fireEvent.change(
      screen.getByRole("textbox", { name: 'Edit "Step one"' }),
      { target: { value: "  Renamed step  " } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save checklist item" }),
    );

    await waitFor(() =>
      expect(currentChecklist()[0].text).toBe("Renamed step"),
    );
    expect(currentChecklist()).toHaveLength(2);
  });

  it("deletes a checklist item and keeps the remaining order", async () => {
    seedTask(baseItems);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: 'Delete "Step one"' }));

    await waitFor(() => expect(currentChecklist()).toHaveLength(1));
    expect(currentChecklist()[0].id).toBe("c2");
    expect(currentChecklist()[0].text).toBe("Step two");
  });

  it("does not add a whitespace-only checklist item", async () => {
    seedTask(baseItems);

    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));
    fireEvent.change(screen.getByLabelText("New checklist item"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));

    await flush();

    expect(currentChecklist()).toHaveLength(2);
    expect(
      currentChecklist().every((item) => item.text.trim() === item.text),
    ).toBe(true);
  });
});
