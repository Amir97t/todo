import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import { clearAccessToken, getAccessToken, subscribeToAuthToken } from "../lib/authSession.js";
import { AuthContext } from "./AuthContext.js";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAccessToken());
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState(null);

  useEffect(() => subscribeToAuthToken(setToken), []);

  // The async operation returns a result without updating React state.
  // This keeps its effect caller free of synchronous state transitions.
  const performSessionRestore = useCallback(async () => {
    try {
      await auth.refresh();
      return { status: "authenticated", error: null };
    } catch (cause) {
      clearAccessToken();
      if (cause instanceof ApiError && cause.status === 401) {
        return { status: "unauthenticated", error: null };
      }
      return {
        status: "error",
        error: cause?.message || "Unable to connect to the server.",
      };
    }
  }, []);

  const applySessionRestoreResult = useCallback((result) => {
    setError(result.error);
    setStatus(result.status);
  }, []);

  // Explicit retries enter the checking state immediately.
  const restoreSession = useCallback(async () => {
    setStatus("checking");
    setError(null);
    const result = await performSessionRestore();
    applySessionRestoreResult(result);
    return result.status === "authenticated";
  }, [performSessionRestore, applySessionRestoreResult]);

  useEffect(() => {
    let active = true;

    performSessionRestore().then((result) => {
      if (active) applySessionRestoreResult(result);
    });

    return () => {
      active = false;
    };
  }, [performSessionRestore, applySessionRestoreResult]);

  const login = useCallback(async (credentials) => {
    setError(null);
    await auth.login(credentials);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (credentials) => {
    setError(null);
    await auth.register(credentials);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await auth.logout();
      setStatus("unauthenticated");
    } catch (cause) {
      setError(cause?.message || "Sign out could not be completed.");
      setStatus("error");
      throw cause;
    }
  }, []);

  const value = useMemo(() => ({
    status,
    isAuthenticated: status === "authenticated" && Boolean(token),
    error,
    clearError: () => setError(null),
    login,
    register,
    logout,
    restoreSession,
  }), [status, token, error, login, register, logout, restoreSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

