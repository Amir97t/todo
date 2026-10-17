import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import { clearAccessToken, getAccessToken, subscribeToAuthToken } from "../lib/authSession.js";
import { AuthContext } from "./AuthContext.js";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAccessToken());
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState(null);

  useEffect(() => subscribeToAuthToken(setToken), []);

  // The first update happens only after the asynchronous refresh settles.
  // Initial state is already "checking", so the mount effect needs no
  // synchronous state updates of its own.
  const performSessionRestore = useCallback(async () => {
    try {
      await auth.refresh();
      setError(null);
      setStatus("authenticated");
      return true;
    } catch (cause) {
      clearAccessToken();
      if (cause instanceof ApiError && cause.status === 401) {
        setError(null);
        setStatus("unauthenticated");
        return false;
      }
      setError(cause?.message || "Unable to connect to the server.");
      setStatus("error");
      return false;
    }
  }, []);

  // Explicit retries enter the checking state immediately; the initial
  // effect calls performSessionRestore directly because status starts there.
  const restoreSession = useCallback(() => {
    setStatus("checking");
    setError(null);
    return performSessionRestore();
  }, [performSessionRestore]);

  useEffect(() => {
    void performSessionRestore();
  }, [performSessionRestore]);

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

