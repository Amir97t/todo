import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewListForm from "./NewListForm.jsx";

async function submit(value) {
  fireEvent.click(screen.getByRole("button", { name: "+ New List" }));
  fireEvent.change(screen.getByPlaceholderText("List name..."), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("NewListForm async onSave contract", () => {
  it("closes and resets when onSave resolves true", async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(<NewListForm onSave={onSave} />);
    await submit("   Work   ");

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith("Work", expect.any(String)),
    );

    // Only a real `true` may close the form.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("List name...")).toBeNull(),
    );
    expect(screen.getByRole("button", { name: "+ New List" })).toBeTruthy();
  });

  it("stays open when onSave resolves false", async () => {
    const onSave = vi.fn().mockResolvedValue(false);

    render(<NewListForm onSave={onSave} />);
    await submit("Duplicate");

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // A Promise is always truthy, so awaiting it is what keeps this open.
    expect(screen.getByPlaceholderText("List name...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ New List" })).toBeNull();
  });
});
