import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, ApiError } from "../lib/api.js";
import { clearAccessToken, getAccessToken, subscribeToAuthToken } from "../lib/authSession.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAccessToken());
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState(null);

  useEffect(() => subscribeToAuthToken(setToken), []);

  const restoreSession = useCallback(async () => {
    setStatus("checking");
    setError(null);

    try {
      await auth.refresh();
      setStatus("authenticated");
      return true;
    } catch (cause) {
      clearAccessToken();
      if (cause instanceof ApiError && cause.status === 401) {
        setStatus("unauthenticated");
        return false;
      }
      setError(cause?.message || "Unable to connect to the server.");
      setStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

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
    await auth.logout();
    setStatus("unauthenticated");
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

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
