import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError, auth } from "../lib/api.js";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/authSession.js";
import { AuthProvider } from "./AuthProvider.jsx";
import { useAuth } from "./AuthContext.js";

function AuthStateProbe() {
  const { status, isAuthenticated, error, login, register, logout, restoreSession } = useAuth();

  return (
    <div>
      <output data-testid="status">{status}</output>
      <output data-testid="authenticated">{String(isAuthenticated)}</output>
      <output data-testid="error">{error ?? ""}</output>
      <button type="button" onClick={() => void login({ email: "user@example.com", password: "password123" }).catch(() => {})}>
        Log in
      </button>
      <button type="button" onClick={() => void register({ email: "new@example.com", password: "password123" }).catch(() => {})}>
        Register
      </button>
      <button type="button" onClick={() => void logout().catch(() => {})}>Log out</button>
      <button type="button" onClick={() => void restoreSession()}>Retry session</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthStateProbe />
    </AuthProvider>,
  );
}

function setAuthenticatedToken(token) {
  setAccessToken(token);
  return { accessToken: token };
}

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    clearAccessToken();
    vi.spyOn(auth, "refresh").mockRejectedValue(
      new ApiError(401, "UNAUTHORIZED", "No active session."),
    );
    vi.spyOn(auth, "login").mockImplementation(async () => setAuthenticatedToken("login-access"));
    vi.spyOn(auth, "register").mockImplementation(async () => setAuthenticatedToken("register-access"));
    vi.spyOn(auth, "logout").mockImplementation(async () => clearAccessToken());
  });

  afterEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
  });

  it("restores a session when refresh succeeds", async () => {
    auth.refresh.mockImplementation(async () => setAuthenticatedToken("restored-access"));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(getAccessToken()).toBe("restored-access");
  });

  it("treats a 401 during startup restore as a normal signed-out state", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("error").textContent).toBe("");
    expect(getAccessToken()).toBeNull();
  });

  it("surfaces a non-auth restore failure as an error state", async () => {
    auth.refresh.mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "Unable to reach the server."),
    );

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));
    expect(screen.getByTestId("error").textContent).toBe("Unable to reach the server.");
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("enters the authenticated state after login", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(auth.login).toHaveBeenCalledWith({ email: "user@example.com", password: "password123" });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
  });

  it("enters the authenticated state after registration", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(auth.register).toHaveBeenCalledWith({ email: "new@example.com", password: "password123" });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
  });

  it("returns to the signed-out state after logout", async () => {
    auth.refresh.mockImplementation(async () => setAuthenticatedToken("restored-access"));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(getAccessToken()).toBeNull();
  });

  it("clears auth state and exposes an error when logout fails", async () => {
    auth.refresh.mockImplementation(async () => setAuthenticatedToken("restored-access"));
    auth.logout.mockImplementation(async () => {
      clearAccessToken();
      throw new ApiError(0, "NETWORK_ERROR", "Sign out could not be completed.");
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("error"));
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toBe("Sign out could not be completed.");
    expect(getAccessToken()).toBeNull();
  });
});
