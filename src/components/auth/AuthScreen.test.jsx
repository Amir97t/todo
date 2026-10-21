import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext } from "../../context/AuthContext.js";
import AuthScreen from "./AuthScreen.jsx";

function renderAuthScreen(overrides = {}) {
  const value = {
    login: vi.fn().mockResolvedValue({ accessToken: "login-access" }),
    register: vi.fn().mockResolvedValue({ accessToken: "register-access" }),
    error: null,
    clearError: vi.fn(),
    restoreSession: vi.fn().mockResolvedValue(true),
    ...overrides,
  };

  render(
    <AuthContext.Provider value={value}>
      <AuthScreen />
    </AuthContext.Provider>,
  );

  return value;
}

describe("AuthScreen", () => {
  it("shows the login form and switches to registration mode", () => {
    renderAuthScreen();

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe("current-password");

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("trims the email and submits login credentials", async () => {
    const value = renderAuthScreen();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  person@example.com  " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(value.login).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
    }));
    expect(value.register).not.toHaveBeenCalled();
  });

  it("submits registration after the user switches modes", async () => {
    const value = renderAuthScreen();

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(value.register).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
    }));
    expect(value.login).not.toHaveBeenCalled();
  });

  it("shows a safe user-facing message when login fails", async () => {
    const value = renderAuthScreen({
      login: vi.fn().mockRejectedValue(new Error("Invalid email or password.")),
    });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Invalid email or password.");
    expect(value.login).toHaveBeenCalledTimes(1);
  });
});
