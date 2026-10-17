import { clearAccessToken, getAccessToken, setAccessToken } from "./authSession.js";

const API_PREFIX = "/api/v1";
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Every backend failure — validation, domain or transport — is surfaced to
 * callers as this shape, so no component ever sees a raw Response.
 */
export class ApiError extends Error {
  constructor(status, code, message) {
    const text = Array.isArray(message)
      ? message.join("; ")
      : typeof message === "string" && message
        ? message
        : "The request could not be completed.";

    super(text);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function resolveBaseUrl() {
  const raw = (import.meta.env || {}).VITE_API_URL;
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  return (trimmed || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function toQueryString(params) {
  if (!params) return "";

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function buildUrl(path, params) {
  return `${resolveBaseUrl()}${API_PREFIX}${path}${toQueryString(params)}`;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Gateways can answer with HTML instead of the JSON envelope.
    return null;
  }
}

function fallbackCode(status) {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

function fallbackMessage(status) {
  return status >= 500
    ? "The server encountered an error."
    : "The request could not be completed.";
}

async function performRequest(
  path,
  {
    method = "GET",
    body,
    query,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    credentials = "omit",
    csrfToken,
    retryAuth = true,
  } = {},
) {
  const url = buildUrl(path, query);
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener("abort", forwardAbort, { once: true });
  }

  let response;

  try {
    const headers = body === undefined
      ? { Accept: "application/json" }
      : { Accept: "application/json", "Content-Type": "application/json" };
    const token = getAccessToken();

    if (token && !path.startsWith("/auth/")) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials,
      signal: controller.signal,
    });
  } catch {
    if (timedOut) {
      throw new ApiError(0, "TIMEOUT", "The request timed out.");
    }
    if (signal?.aborted) {
      throw new ApiError(0, "ABORTED", "The request was cancelled.");
    }
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server.");
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", forwardAbort);
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? fallbackCode(response.status),
      payload?.message ?? fallbackMessage(response.status),
    );
  }

  return payload;
}

export async function request(path, options = {}) {
  try {
    return await performRequest(path, options);
  } catch (error) {
    const mayRefresh =
      options.retryAuth !== false &&
      error instanceof ApiError &&
      error.status === 401 &&
      getAccessToken() !== null &&
      !path.startsWith("/auth/");

    if (!mayRefresh) throw error;

    try {
      await refreshAuthSession();
    } catch {
      clearAccessToken();
      throw error;
    }

    return performRequest(path, { ...options, retryAuth: false });
  }
}

async function getCsrfToken() {
  const payload = await performRequest("/auth/csrf", {
    credentials: "include",
    retryAuth: false,
  });

  if (typeof payload?.csrfToken !== "string" || payload.csrfToken.length === 0) {
    throw new ApiError(502, "CSRF_TOKEN_MISSING", "Unable to establish a secure session.");
  }

  return payload.csrfToken;
}

async function postAuth(path, body) {
  const csrfToken = await getCsrfToken();
  return performRequest(path, {
    method: "POST",
    body,
    credentials: "include",
    csrfToken,
    retryAuth: false,
  });
}

function acceptAuthResponse(payload) {
  if (typeof payload?.accessToken !== "string" || payload.accessToken.length === 0) {
    clearAccessToken();
    throw new ApiError(502, "ACCESS_TOKEN_MISSING", "The server returned an invalid authentication response.");
  }

  setAccessToken(payload.accessToken);
  return payload;
}

export const auth = {
  register: async ({ email, password }) =>
    acceptAuthResponse(await postAuth("/auth/register", { email, password })),

  login: async ({ email, password }) =>
    acceptAuthResponse(await postAuth("/auth/login", { email, password })),

  refresh: refreshAuthSession,

  logout: async () => {
    try {
      await postAuth("/auth/logout");
    } finally {
      clearAccessToken();
    }
  },
};

async function refreshAuthSession() {
  try {
    return acceptAuthResponse(await postAuth("/auth/refresh"));
  } catch (error) {
    clearAccessToken();
    throw error;
  }
}

function idPath(...segments) {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export const lists = {
  get: (signal) => request("/lists", { signal }),

  create: (body, signal) => request("/lists", { method: "POST", body, signal }),

  update: (id, body, signal) =>
    request(`/lists/${idPath(id)}`, { method: "PATCH", body, signal }),

  remove: (id, { strategy = "relocate", signal } = {}) =>
    request(`/lists/${idPath(id)}`, {
      method: "DELETE",
      query: { strategy },
      signal,
    }),
};

export const tasks = {
  get: (query, signal) => request("/tasks", { query, signal }),

  create: (body, signal) => request("/tasks", { method: "POST", body, signal }),

  update: (id, body, signal) =>
    request(`/tasks/${idPath(id)}`, { method: "PATCH", body, signal }),

  remove: (id, signal) =>
    request(`/tasks/${idPath(id)}`, { method: "DELETE", signal }),
};

export const checklist = {
  create: (taskId, body, signal) =>
    request(`/tasks/${idPath(taskId)}/checklist`, { method: "POST", body, signal }),

  update: (taskId, itemId, body, signal) =>
    request(`/tasks/${idPath(taskId)}/checklist/${idPath(itemId)}`, {
      method: "PATCH",
      body,
      signal,
    }),

  remove: (taskId, itemId, signal) =>
    request(`/tasks/${idPath(taskId)}/checklist/${idPath(itemId)}`, {
      method: "DELETE",
      signal,
    }),
};
