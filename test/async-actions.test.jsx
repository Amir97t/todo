import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { db, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi } = await import("./fakeApi.js");
  return fakeApi;
});

// main.jsx mounts App inside ThemeProvider, which CelestialBackground requires.
function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

const legacyLists = () => JSON.parse(localStorage.getItem("todo-app-lists"));
const legacyTasks = () => JSON.parse(localStorage.getItem("todo-app-tasks"));
const migrationRecord = () =>
  JSON.parse(localStorage.getItem("todo-app-migration"));

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
  localStorage.setItem("todo-app-selected-list", JSON.stringify(selectedList));
  localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
  reset();
}

async function boot() {
  renderApp();
  await waitFor(() => expect(migrationRecord()?.status).toBe("done"));
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

// Tasks reach the fake server through the migration, never by pre-seeding it:
// server data that migration did not create is treated as a conflict.
function seedWithTask(overrides = {}) {
  seed({ taskRows: [taskRow(overrides)], selectedList: "l1" });
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

    await boot();
    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(screen.getByPlaceholderText("List name..."), {
      target: { value: "   Projects   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(db.lists.map((row) => row.name)).toContain("Projects"),
    );

    const created = db.lists.find((row) => row.name === "Projects");
    expect(created.name).toBe("Projects");
    expect(created.id).not.toBe("inbox");
    expect(screen.queryByPlaceholderText("List name...")).toBeNull();
  });

  it("rejects a duplicate name and keeps the form open", async () => {
    seed();
    await boot();
    const before = db.lists.length;

    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(screen.getByPlaceholderText("List name..."), {
      target: { value: "work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await flush();

    expect(db.lists).toHaveLength(before);
    expect(screen.getByPlaceholderText("List name...")).toBeTruthy();
  });

  it("renames a list and leaves edit mode", async () => {
    seed();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "Rename Work" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Design  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(db.lists.find((row) => row.name === "Design")).toBeTruthy(),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps edit mode when a rename is rejected", async () => {
    seed();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "Rename Work" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await flush();

    expect(db.lists.find((row) => row.id === "l1")).toBeUndefined();
    expect(db.lists.some((row) => row.name === "Design")).toBe(false);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("relocates tasks when deleting a list", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });
    await boot();

    const workList = db.lists.find((row) => row.name === "Work");
    fireEvent.click(
      screen.getByRole("button", { name: `Delete ${workList.name}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete List" }));

    await waitFor(() =>
      expect(db.lists.some((row) => row.name === "Work")).toBe(false),
    );
    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].listId).toBe(INBOX_LIST_ID);
  });

  it("removes tasks when deleting a list with its tasks", async () => {
    seed({ taskRows: [taskRow()], selectedList: "l1" });
    await boot();

    const workList = db.lists.find((row) => row.name === "Work");
    fireEvent.click(
      screen.getByRole("button", { name: `Delete ${workList.name}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete List & Tasks" }),
    );

    await waitFor(() => expect(db.tasks).toHaveLength(0));
    expect(db.lists.some((row) => row.name === "Work")).toBe(false);
  });
});

describe("task actions", () => {
  it("creates a task through the API", async () => {
    seed();
    await boot();

    await openAddTask();
    await submitTask("   Ship API   ");

    expect(db.tasks).toHaveLength(1);
    const created = db.tasks[0];
    expect(created.title).toBe("Ship API");
    expect(created.completed).toBe(false);
    expect(typeof created.id).toBe("string");
    // The API owns timestamps now, so createdAt is an ISO string.
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.checklist).toEqual([]);
  });

  it("falls back to the Inbox when the selected list no longer exists", async () => {
    seed({ selectedList: "missing-list" });
    await boot();

    await openAddTask();
    await submitTask("Orphan");

    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].listId).toBe(INBOX_LIST_ID);
  });

  it("toggles a task", async () => {
    seedWithTask();
    await boot();
    expect(db.tasks).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("checkbox", { name: 'Mark "Ship it" as completed' }),
    );

    await waitFor(() => expect(db.tasks[0].completed).toBe(true));
  });

  it("edits a task title", async () => {
    seedWithTask();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), {
      target: { value: "  Shipped  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(db.tasks[0].title).toBe("Shipped"));
    expect(db.tasks[0].completed).toBe(false);
  });

  it("deletes a task", async () => {
    seedWithTask();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(db.tasks).toHaveLength(0));
  });
});

describe("checklist actions", () => {
  function bootWithChecklist() {
    seed({
      taskRows: [
        taskRow({
          checklist: [
            { id: "c1", text: "Step one", completed: false },
            { id: "c2", text: "Step two", completed: false },
          ],
        }),
      ],
      selectedList: "l1",
    });
    return boot();
  }

  const currentChecklist = () => db.tasks[0].checklist;

  it("appends an item at the next position", async () => {
    await bootWithChecklist();

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
    expect(rows.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(rows[2].completed).toBe(false);
  });

  it("toggles a checklist item", async () => {
    await bootWithChecklist();

    fireEvent.click(
      screen.getByRole("button", { name: 'Mark "Step one" complete' }),
    );

    await waitFor(() => expect(currentChecklist()[0].completed).toBe(true));
    expect(currentChecklist()[1].completed).toBe(false);
  });

  it("edits a checklist item text", async () => {
    await bootWithChecklist();

    fireEvent.click(screen.getByRole("button", { name: 'Edit "Step one"' }));
    fireEvent.change(
      screen.getByRole("textbox", { name: 'Edit "Step one"' }),
      { target: { value: "  Renamed step  " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save checklist item" }));

    await waitFor(() => expect(currentChecklist()[0].text).toBe("Renamed step"));
    expect(currentChecklist()).toHaveLength(2);
  });

  it("deletes a checklist item and keeps the remaining order", async () => {
    await bootWithChecklist();

    fireEvent.click(screen.getByRole("button", { name: 'Delete "Step one"' }));

    await waitFor(() => expect(currentChecklist()).toHaveLength(1));
    expect(currentChecklist()[0].text).toBe("Step two");
    expect(currentChecklist()[0].position).toBe(1);
  });

  it("does not add a whitespace-only checklist item", async () => {
    await bootWithChecklist();

    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));
    fireEvent.change(screen.getByLabelText("New checklist item"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add checklist item" }));

    await flush();

    expect(currentChecklist()).toHaveLength(2);
  });
});

describe("store boundary", () => {
  it("leaves the legacy keys untouched after migrating", async () => {
    const listRows = [
      { id: "inbox", name: "Inbox", icon: "inbox" },
      { id: "l1", name: "Work", icon: "briefcase" },
    ];
    const taskRows = [taskRow()];

    seed({ listRows, taskRows, selectedList: "inbox" });
    const listsBefore = localStorage.getItem("todo-app-lists");
    const tasksBefore = localStorage.getItem("todo-app-tasks");

    await boot();

    expect(localStorage.getItem("todo-app-lists")).toBe(listsBefore);
    expect(localStorage.getItem("todo-app-tasks")).toBe(tasksBefore);
    expect(legacyLists()).toEqual(listRows);
    expect(legacyTasks()).toEqual(taskRows);
  });

  it("translates the legacy selected list to the real Inbox id", async () => {
    seed({ selectedList: "inbox" });

    await boot();

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("todo-app-selected-list"))).toBe(
        INBOX_LIST_ID,
      ),
    );
  });

  it("falls back to the Inbox when the selected list no longer exists", async () => {
    seed({ selectedList: "gone-forever" });

    await boot();

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("todo-app-selected-list"))).toBe(
        INBOX_LIST_ID,
      ),
    );
  });

  it("stops writing legacy keys once the store has switched", async () => {
    seed();

    await boot();
    const listsBefore = localStorage.getItem("todo-app-lists");
    const tasksBefore = localStorage.getItem("todo-app-tasks");

    await openAddTask();
    await submitTask("After the switch");

    expect(db.tasks).toHaveLength(1);
    expect(localStorage.getItem("todo-app-lists")).toBe(listsBefore);
    expect(localStorage.getItem("todo-app-tasks")).toBe(tasksBefore);
  });
});
