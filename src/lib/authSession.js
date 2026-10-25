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

/**
 * Reads the subject only to namespace browser-local migration metadata.
 * Authorization decisions are always made by the API, never by this value.
 */
export function getAccessTokenSubject() {
  if (!accessToken) return null;

  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}
