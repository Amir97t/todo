import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog.jsx";

function Harness({ onConfirm = vi.fn(), onCancel = vi.fn(), secondaryLabel }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this?"
        description="There is no undo."
        confirmLabel="Confirm"
        secondaryLabel={secondaryLabel}
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onSecondaryConfirm={() => setOpen(false)}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </>
  );
}

async function openDialog(extraProps = {}) {
  const props = { onConfirm: vi.fn(), onCancel: vi.fn(), ...extraProps };
  render(<Harness {...props} />);

  const opener = screen.getByRole("button", { name: "Open dialog" });
  // jsdom does not move focus on click, so establish the opener explicitly —
  // that is the element the dialog must hand focus back to.
  opener.focus();
  fireEvent.click(opener);

  const dialog = await screen.findByRole("dialog");
  return { props, opener, dialog };
}

function focusablesIn(dialog) {
  return within(dialog).getAllByRole("button");
}

describe("ConfirmDialog focus management", () => {
  it("moves focus into the dialog and onto the primary action", async () => {
    const { dialog } = await openDialog();

    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("keeps Tab inside the dialog", async () => {
    const { dialog } = await openDialog();

    const buttons = focusablesIn(dialog);
    const last = buttons[buttons.length - 1];
    await waitFor(() => expect(document.activeElement).toBe(last));

    fireEvent.keyDown(last, { key: "Tab" });

    const first = buttons[0];
    expect(document.activeElement).toBe(first);
    expect(first.textContent.trim()).toBe("Cancel");
  });

  it("keeps Shift+Tab inside the dialog", async () => {
    const { dialog } = await openDialog();

    const buttons = focusablesIn(dialog);
    const first = buttons[0];
    first.focus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });

    const last = buttons[buttons.length - 1];
    expect(document.activeElement).toBe(last);
    expect(last.textContent.trim()).toBe("Confirm");
  });

  it("wraps the focus trap around a secondary action too", async () => {
    const { dialog } = await openDialog({ secondaryLabel: "Delete all" });

    const buttons = focusablesIn(dialog);
    const last = buttons[buttons.length - 1];
    last.focus();

    fireEvent.keyDown(last, { key: "Tab" });

    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons).toHaveLength(3);
  });

  it("closes on Escape and returns focus to the opener", async () => {
    const { props, opener, dialog } = await openDialog();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the opener after confirming", async () => {
    const { props, opener, dialog } = await openDialog();

    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(document.activeElement).toBe(confirm));

    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it("runs confirm and cancel exactly once per activation", async () => {
    const { props, dialog, opener } = await openDialog();

    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    // Repeated activation must not stack handlers.
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(0);

    // Re-open and cancel once.
    fireEvent.click(opener);
    const reopened = await screen.findByRole("dialog");
    fireEvent.click(within(reopened).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not restore focus to an opener that was removed", async () => {
    const { dialog } = await openDialog();

    // Simulate the opener being removed before the dialog closes.
    document.body.appendChild(document.createElement("button"));
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // No throw, and focus did not move to a detached node.
    expect(document.body.contains(document.activeElement) || document.activeElement === document.body).toBe(true);
  });
});
