import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  auth,
  clearAccessToken,
  buildUrl,
  checklist,
  lists,
  request,
  resolveBaseUrl,
  tasks,
  getAccessToken,
  toQueryString,
} from "./api.js";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function htmlResponse(status, html) {
  return {
    ok: false,
    status,
    text: async () => html,
  };
}

describe("URL construction", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost:3000 when the env var is unset", () => {
    expect(resolveBaseUrl()).toBe("http://localhost:3000");
  });

  it("uses VITE_API_URL when provided", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    expect(resolveBaseUrl()).toBe("https://api.example.com");
  });

  it("strips a trailing slash from VITE_API_URL", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    expect(resolveBaseUrl()).toBe("https://api.example.com");
  });

  it("ignores a whitespace-only value", () => {
    vi.stubEnv("VITE_API_URL", "   ");
    expect(resolveBaseUrl()).toBe("http://localhost:3000");
  });

  it("prefixes every path with /api/v1", () => {
    expect(buildUrl("/tasks")).toBe("http://localhost:3000/api/v1/tasks");
    expect(buildUrl("/lists")).toBe("http://localhost:3000/api/v1/lists");
    expect(buildUrl("/tasks/abc/checklist")).toBe(
      "http://localhost:3000/api/v1/tasks/abc/checklist",
    );
  });
});

describe("query encoding", () => {
  it("encodes values", () => {
    expect(toQueryString({ q: "hello world" })).toBe("?q=hello+world");
    expect(toQueryString({ q: "a&b=c" })).toBe("?q=a%26b%3Dc");
  });

  it("skips undefined, null and empty values", () => {
    expect(
      toQueryString({ a: undefined, b: null, c: "", d: "keep" }),
    ).toBe("?d=keep");
  });

  it("encodes booleans and numbers", () => {
    expect(toQueryString({ completed: false })).toBe("?completed=false");
    expect(toQueryString({ completed: true })).toBe("?completed=true");
    expect(toQueryString({ limit: 5 })).toBe("?limit=5");
  });

  it("returns an empty string when nothing is sent", () => {
    expect(toQueryString()).toBe("");
    expect(toQueryString({})).toBe("");
  });

  it("builds a full url with encoded params", () => {
    expect(buildUrl("/tasks", { q: "buy milk", sort: "az" })).toBe(
      "http://localhost:3000/api/v1/tasks?q=buy+milk&sort=az",
    );
  });
});

describe("error envelope", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_API_URL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps the backend envelope onto ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 409,
          code: "LIST_NAME_EXISTS",
          message: "A list with that name already exists.",
          error: "Conflict",
        },
        { status: 409 },
      ),
    );

    await expect(request("/lists", { method: "POST", body: {} })).rejects
      .toMatchObject({
        name: "ApiError",
        status: 409,
        code: "LIST_NAME_EXISTS",
        message: "A list with that name already exists.",
      });
  });

  it("joins a validation message array into a single string", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: ["title should not be empty", "icon is invalid"],
          error: "Bad Request",
        },
        { status: 400 },
      ),
    );

    const error = await request("/tasks", { method: "POST", body: {} }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("title should not be empty; icon is invalid");
  });

  it("falls back when the body is not the JSON envelope", async () => {
    fetchMock.mockResolvedValue(htmlResponse(502, "<html>Bad Gateway</html>"));

    const error = await request("/lists").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("SERVER_ERROR");
    expect(error.message).toBe("The server encountered an error.");
    expect(error.message).not.toContain("<html>");
  });

  it("reports a transport failure without leaking internals", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await request("/lists").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Unable to reach the server.");
  });

  it("returns the parsed payload on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: "1" }]));

    await expect(request("/lists")).resolves.toEqual([{ id: "1" }]);
  });
});


describe("authentication requests", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    clearAccessToken();
  });

  afterEach(() => {
    clearAccessToken();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fetches a CSRF token and sends it with login using cookie credentials", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-1" }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "access-1" }));

    await auth.login({ email: "person@example.com", password: "password123" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/v1/auth/csrf",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-1",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ email: "person@example.com", password: "password123" }),
      }),
    );
    expect(getAccessToken()).toBe("access-1");
  });

  it("attaches the in-memory bearer token to protected API requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "list-1" }));
    await auth.login;
    const { setAccessToken } = await import("./authSession.js");
    setAccessToken("access-2");

    await request("/lists");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/lists",
      expect.objectContaining({
        credentials: "omit",
        headers: expect.objectContaining({ Authorization: "Bearer access-2" }),
      }),
    );
  });

  it("refreshes once after a protected request returns 401", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ message: "Unauthorized" }) })
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-2" }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "access-3" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "list-1" }]));

    const { setAccessToken } = await import("./authSession.js");
    setAccessToken("expired-token");

    await expect(request("/lists")).resolves.toEqual([{ id: "list-1" }]);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.example.com/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer access-3");
  });

  it("clears the in-memory token after logout even if the request fails", async () => {
    const { setAccessToken } = await import("./authSession.js");
    setAccessToken("access-4");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "csrf-3" }))
      .mockRejectedValueOnce(new TypeError("network down"));

    await expect(auth.logout()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(getAccessToken()).toBeNull();
  });
});

describe("endpoint routing", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_API_URL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps each endpoint to the right method and path", async () => {
    await lists.get();
    await lists.create({ name: "Work" });
    await lists.update("list-1", { name: "Home" });
    await lists.remove("list-1", { strategy: "delete" });
    await tasks.get({ listId: "l", completed: false });
    await tasks.create({ title: "T" });
    await tasks.update("task-1", { completed: true });
    await tasks.remove("task-1");
    await checklist.create("task-1", { text: "step" });
    await checklist.update("task-1", "item-1", { completed: true });
    await checklist.remove("task-1", "item-1");

    const calls = fetchMock.mock.calls.map(
      ([url, init]) => `${init.method ?? "GET"} ${url}`,
    );

    expect(calls).toEqual([
      "GET http://localhost:3000/api/v1/lists",
      "POST http://localhost:3000/api/v1/lists",
      "PATCH http://localhost:3000/api/v1/lists/list-1",
      "DELETE http://localhost:3000/api/v1/lists/list-1?strategy=delete",
      "GET http://localhost:3000/api/v1/tasks?listId=l&completed=false",
      "POST http://localhost:3000/api/v1/tasks",
      "PATCH http://localhost:3000/api/v1/tasks/task-1",
      "DELETE http://localhost:3000/api/v1/tasks/task-1",
      "POST http://localhost:3000/api/v1/tasks/task-1/checklist",
      "PATCH http://localhost:3000/api/v1/tasks/task-1/checklist/item-1",
      "DELETE http://localhost:3000/api/v1/tasks/task-1/checklist/item-1",
    ]);
  });

  it("serialises request bodies as JSON", async () => {
    await lists.create({ name: "Work", icon: "briefcase" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ name: "Work", icon: "briefcase" });
  });
});
