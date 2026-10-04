import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Sidebar from "./Sidebar.jsx";

const lists = [
  { id: "inbox", name: "Inbox", icon: "inbox" },
  { id: "l1", name: "Work", icon: "briefcase" },
];

function renderSidebar(renameList) {
  return render(
    <Sidebar
      lists={lists}
      selectedListId="inbox"
      onSelect={vi.fn()}
      addList={vi.fn()}
      renameList={renameList}
      deleteList={vi.fn()}
    />,
  );
}

async function renameTo(value) {
  fireEvent.click(screen.getByRole("button", { name: "Rename Work" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("Sidebar rename async contract", () => {
  beforeEach(() => {
    localStorage.setItem("todo-app-sidebar-collapsed", "false");
  });

  it("leaves edit mode when renameList resolves true", async () => {
    const renameList = vi.fn().mockResolvedValue(true);

    renderSidebar(renameList);
    await renameTo("Design");

    await waitFor(() =>
      expect(renameList).toHaveBeenCalledWith(
        "l1",
        "Design",
        expect.any(String),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("stays in edit mode when renameList resolves false", async () => {
    const renameList = vi.fn().mockResolvedValue(false);

    renderSidebar(renameList);
    await renameTo("Design");

    await waitFor(() => expect(renameList).toHaveBeenCalledTimes(1));

    // Edit mode must not be treated as successful without a real `true`.
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
