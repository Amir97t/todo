import { act, render, renderHook, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import ThemeProvider from "../src/context/ThemeProvider.jsx";
import MutationErrorBanner from "../src/components/common/MutationErrorBanner.jsx";
import useAppData from "../src/hooks/useAppData.js";
import { INBOX_LIST_ID } from "../src/lib/constants.js";
import { userMessageFor } from "../src/lib/errorMessages.js";
import { db, fakeApi, lastTaskQuery, reset } from "./fakeApi.js";

vi.mock("../src/lib/api.js", async () => {
  const { fakeApi: api } = await import("./fakeApi.js");
  return api;
});

function apiError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

const FORBIDDEN_TEXT = [
  "P2002",
  "Prisma",
  "SELECT",
  "statusCode",
  "driverAdapter",
  "at Object.",
  "originalCode",
];

function expectFriendly(text) {
  expect(typeof text).toBe("string");
  expect(text.length).toBeGreaterThan(0);
  for (const needle of FORBIDDEN_TEXT) {
    expect(text).not.toContain(needle);
  }
}

beforeEach(() => {
  reset();
});

describe("error message mapping", () => {
  it("maps domain codes to user-facing copy", () => {
    expect(userMessageFor(apiError("LIST_NAME_EXISTS", "x", 409))).toBe(
      "A list with this name already exists.",
    );
    expect(userMessageFor(apiError("LIST_NOT_FOUND", "x", 404))).toBe(
      "That list no longer exists.",
    );
    expect(userMessageFor(apiError("TASK_NOT_FOUND", "x", 404))).toBe(
      "That task no longer exists.",
    );
    expect(userMessageFor(apiError("CHECKLIST_ITEM_NOT_FOUND", "x", 404))).toBe(
      "That checklist item no longer exists.",
    );
    expect(userMessageFor(apiError("INBOX_IMMUTABLE", "x", 403))).toBe(
      "Inbox cannot be modified.",
    );
  });

  it("maps transport failures and unknown errors to friendly copy", () => {
    expect(userMessageFor(apiError("NETWORK_ERROR", "x", 0))).toBe(
      "Unable to reach the server. Please try again.",
    );
    expect(userMessageFor(apiError("TIMEOUT", "x", 0))).toBe(
      "Unable to reach the server. Please try again.",
    );
    expect(userMessageFor({ status: 0 })).toBe(
      "Unable to reach the server. Please try again.",
    );
    expect(userMessageFor(apiError("SOMETHING_ELSE", "raw internals", 500))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(userMessageFor(new TypeError("boom"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("useAppData mutation errors", () => {
  async function readyHook() {
    const utils = renderHook(() => useAppData());
    await waitFor(() => expect(utils.result.current.status).toBe("ready"));
    return utils;
  }

  it("surfaces a friendly message when a task edit fails and leaves the task alone", async () => {
    const { result } = await readyHook();
    await result.current.taskActions.addTask("Original", "", [], INBOX_LIST_ID);
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    const before = result.current.tasks[0];

    const original = fakeApi.tasks.update;
    fakeApi.tasks.update = async () => {
      throw apiError("TASK_NOT_FOUND", "Prisma raw message here", 404);
    };

    try {
      expect(await result.current.taskActions.editTask(before.id, { title: "Nope" })).toBe(false);
    } finally {
      fakeApi.tasks.update = original;
    }

    await waitFor(() => expect(result.current.actionError).toBeTruthy());
    expectFriendly(result.current.actionError);
    expect(result.current.actionError).toBe("That task no longer exists.");
    expect(result.current.tasks[0].title).toBe(before.title);
  });

  it("surfaces a friendly message when a task delete fails and keeps the task", async () => {
    const { result } = await readyHook();
    await result.current.taskActions.addTask("Survivor", "", [], INBOX_LIST_ID);
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    const original = fakeApi.tasks.remove;
    fakeApi.tasks.remove = async () => {
      throw apiError("TASK_NOT_FOUND", "raw db failure", 404);
    };

    try {
      expect(await result.current.taskActions.deleteTask(result.current.tasks[0].id)).toBe(false);
    } finally {
      fakeApi.tasks.remove = original;
    }

    await waitFor(() => expect(result.current.actionError).toBe("That task no longer exists."));
    expect(result.current.tasks).toHaveLength(1);
  });

  it("surfaces a friendly message when a checklist mutation fails and keeps the item", async () => {
    const { result } = await readyHook();
    await result.current.taskActions.addTask("With checklist", "", [], INBOX_LIST_ID);
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    const taskId = result.current.tasks[0].id;
    await result.current.taskActions.addChecklistItem(taskId, "Step one");
    await waitFor(() => expect(result.current.tasks[0].checklist).toHaveLength(1));

    const original = fakeApi.checklist.remove;
    fakeApi.checklist.remove = async () => {
      throw apiError("CHECKLIST_ITEM_NOT_FOUND", "SELECT failed", 404);
    };

    try {
      expect(
        await result.current.taskActions.deleteChecklistItem(
          taskId,
          result.current.tasks[0].checklist[0].id,
        ),
      ).toBe(false);
    } finally {
      fakeApi.checklist.remove = original;
    }

    await waitFor(() =>
      expect(result.current.actionError).toBe(
        "That checklist item no longer exists.",
      ),
    );
    expectFriendly(result.current.actionError);
    expect(result.current.tasks[0].checklist).toHaveLength(1);
  });

  it("keeps a network failure free of technical detail", async () => {
    const { result } = await readyHook();

    const original = fakeApi.lists.create;
    fakeApi.lists.create = async () => {
      throw apiError("NETWORK_ERROR", "connect ECONNREFUSED 127.0.0.1:3000", 0);
    };

    try {
      expect(await result.current.addList("Any name", "folder")).toBe(false);
    } finally {
      fakeApi.lists.create = original;
    }

    await waitFor(() => expect(result.current.actionError).toBeTruthy());
    expect(result.current.actionError).toBe(
      "Unable to reach the server. Please try again.",
    );
    expectFriendly(result.current.actionError);
  });

  it("clears a previous error when a later mutation succeeds", async () => {
    const { result } = await readyHook();

    const original = fakeApi.lists.create;
    fakeApi.lists.create = async () => {
      throw apiError("LIST_NAME_EXISTS", "raw", 409);
    };
    await result.current.addList("Duplicate", "folder");
    await waitFor(() => expect(result.current.actionError).toBeTruthy());

    fakeApi.lists.create = original;
    expect(await result.current.addList("Fresh", "folder")).toBe(true);

    await waitFor(() => expect(result.current.actionError).toBeNull());
    expect(result.current.lists.some((list) => list.name === "Fresh")).toBe(true);
  });

  it("does not raise an error when H1 blocks a duplicate submission", async () => {
    const { result } = await readyHook();

    const original = fakeApi.tasks.create;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    // Delegates to the real fake so the row is genuinely stored once.
    fakeApi.tasks.create = async (...args) => {
      await gate;
      return original(...args);
    };

    try {
      const first = result.current.taskActions.addTask("Dup", "", [], INBOX_LIST_ID);
      const second = result.current.taskActions.addTask("Dup", "", [], INBOX_LIST_ID);

      await waitFor(() =>
        expect(result.current.isPending(`task:create:${INBOX_LIST_ID}`)).toBe(true),
      );
      // A blocked call must neither clear an existing error nor invent one.
      expect(result.current.actionError).toBeNull();

      await act(async () => {
        release();
      });

      const [a, b] = await Promise.all([first, second]);
      expect(a).toBe(true);
      expect(b).toBe(true);
      expect(db.tasks).toHaveLength(1);
      expect(result.current.actionError).toBeNull();
      await waitFor(() =>
        expect(result.current.isPending(`task:create:${INBOX_LIST_ID}`)).toBe(false),
      );
    } finally {
      fakeApi.tasks.create = original;
    }
  });
});

describe("MutationErrorBanner", () => {
  it("renders nothing without a message", () => {
    const { container } = render(<MutationErrorBanner message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("announces as an alert and exposes a labelled dismiss control", () => {
    render(<MutationErrorBanner message="That task no longer exists." onDismiss={() => {}} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("That task no longer exists.");

    const dismiss = screen.getByRole("button", { name: "Dismiss error" });
    expect(dismiss).toBeTruthy();
    // Text is in the document, not only in a title/tooltip.
    expect(alert.textContent).toContain("That task no longer exists.");
  });

  it("dismisses without touching any mutation state", async () => {
    const onDismiss = vi.fn();
    render(<MutationErrorBanner message="Something went wrong." onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("error surface in the app", () => {
  async function boot() {
    localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    );
    await waitFor(() => expect(lastTaskQuery.value?.sort).toBeDefined());
  }

  it("shows a friendly error when a duplicate list is rejected, keeping the form open", async () => {
    reset();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(await screen.findByPlaceholderText("List name..."), {
      target: { value: "Inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A list with this name already exists.");
    expectFriendly(alert.textContent);

    // The form must not have closed on a rejected create.
    expect(screen.getByPlaceholderText("List name...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ New List" })).toBeNull();
  });

  it("dismissing the error leaves the data untouched", async () => {
    reset();
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(await screen.findByPlaceholderText("List name..."), {
      target: { value: "Inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");

    const listsBefore = db.lists.map((list) => list.id);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(db.lists.map((list) => list.id)).toEqual(listsBefore);
  });

  it("clears the previous error once a later attempt succeeds", async () => {
    reset();
    await boot();

    // First attempt: duplicate, rejected.
    fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
    fireEvent.change(await screen.findByPlaceholderText("List name..."), {
      target: { value: "Inbox" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");

    // Second attempt with a free name: the error must clear and the form close.
    fireEvent.change(screen.getByPlaceholderText("List name..."), {
      target: { value: "Recovered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(db.lists.some((list) => list.name === "Recovered")).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.queryByPlaceholderText("List name...")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rename Recovered" }),
    ).toBeTruthy();
  });
});
