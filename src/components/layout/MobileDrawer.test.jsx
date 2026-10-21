import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Sidebar from "./Sidebar.jsx";
import { INBOX_LIST_ID } from "../../lib/constants.js";

const lists = [
  { id: INBOX_LIST_ID, name: "Inbox", icon: "inbox" },
  { id: "l1", name: "Work", icon: "briefcase" },
];

function renderSidebar(props = {}) {
  return render(
    <Sidebar
      lists={lists}
      selectedListId={INBOX_LIST_ID}
      onSelect={vi.fn()}
      addList={vi.fn()}
      renameList={vi.fn()}
      deleteList={vi.fn()}
      {...props}
    />,
  );
}

// The drawer is the only element carrying `inert` while closed, and React
// keeps that same node across the toggle.
const closedDrawer = () => document.querySelector("div[inert]");

const mobileTrigger = () =>
  [...document.querySelectorAll('button[aria-label="Open notebook"]')].find(
    (button) => !button.closest("aside"),
  );

describe("mobile drawer accessibility", () => {
  beforeEach(() => {
    localStorage.setItem("todo-app-sidebar-collapsed", JSON.stringify(false));
  });

  it("is inert and hidden from assistive tech while closed", () => {
    renderSidebar();

    const drawer = closedDrawer();
    expect(drawer).not.toBeNull();
    expect(drawer.hasAttribute("inert")).toBe(true);
    expect(drawer.getAttribute("aria-hidden")).toBe("true");

    // The descendants are still present — `inert` is what takes them out of
    // the tab order and the accessibility tree, which jsdom does not enforce.
    expect(drawer.querySelectorAll("button, a, input").length).toBeGreaterThan(0);
  });

  it("exposes controls and takes focus when opened", async () => {
    renderSidebar();

    const trigger = mobileTrigger();
    expect(trigger).toBeTruthy();
    trigger.focus();

    const drawer = closedDrawer();
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(drawer.hasAttribute("inert")).toBe(false);
      expect(drawer.getAttribute("aria-hidden")).not.toBe("true");
    });
    await waitFor(() =>
      expect(drawer.contains(document.activeElement)).toBe(true),
    );
  });

  it("returns focus to the trigger when closed", async () => {
    renderSidebar();

    const trigger = mobileTrigger();
    trigger.focus();
    const drawer = closedDrawer();

    fireEvent.click(trigger);
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));

    fireEvent.click(
      within(drawer).getByRole("button", { name: "Close notebook" }),
    );

    await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(true));
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    renderSidebar();

    const trigger = mobileTrigger();
    trigger.focus();
    const drawer = closedDrawer();

    fireEvent.click(trigger);
    await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(false));

    fireEvent.keyDown(drawer, { key: "Escape" });

    await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(true));
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves the desktop sidebar behaviour unchanged", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rename Work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Work" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rename Inbox" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Inbox" })).toBeNull();
  });
});
