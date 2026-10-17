/**
 * Access-token state for the browser session.
 *
 * The access token is intentionally kept in module memory, never localStorage.
 * The refresh token remains in the backend's HttpOnly cookie.
 */
let accessToken = null;
const listeners = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new TypeError("An access token must be a non-empty string.");
  }

  accessToken = token;
  notify();
}

export function clearAccessToken() {
  if (accessToken === null) return;
  accessToken = null;
  notify();
}

export function subscribeToAuthToken(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("Auth token listener must be a function.");
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) {
    listener(accessToken);
  }
}
