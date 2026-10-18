import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/proxy.js";

const UPSTREAM = "https://tasknote-api-git-feat-auth-cors-d68308-amirs-projects-16941eb8.vercel.app";

function makeRequest({ url, method = "GET", headers = {}, body } = {}) {
  return {
    url,
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body);
    },
  };
}

function makeResponse() {
  const headers = new Map();
  let body = "";
  return {
    statusCode: 200,
    setHeader: vi.fn((name, value) => headers.set(name.toLowerCase(), value)),
    end: vi.fn((value) => {
      body = value === undefined ? "" : Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
    }),
    getHeader: (name) => headers.get(name.toLowerCase()),
    get body() {
      return body;
    },
  };
}

describe("Tasknote Preview API proxy", () => {
  beforeEach(() => {
    vi.stubEnv("TASKNOTE_API_UPSTREAM", UPSTREAM);
    vi.stubEnv("TASKNOTE_API_BYPASS_SECRET", "test-only-secret");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards CSRF requests through the protected upstream and preserves cookies", async () => {
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ csrfToken: "test-csrf" }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "set-cookie": "csrfToken=test-csrf; Path=/; Secure; SameSite=None",
        },
      }),
    );

    const req = makeRequest({
      url: "/api/proxy?__proxyPath=auth/csrf&source=web",
      headers: { origin: "https://tasknote-web.example", cookie: "session=test" },
    });
    const res = makeResponse();

    await handler(req, res);

    const [calledUrl, options] = fetch.mock.calls[0];
    expect(new URL(calledUrl).pathname).toBe("/api/v1/auth/csrf");
    expect(new URL(calledUrl).searchParams.get("source")).toBe("web");
    expect(options.headers.get("x-vercel-protection-bypass")).toBe("test-only-secret");
    expect(options.headers.get("origin")).toBe("https://tasknote-web.example");
    expect(options.headers.get("cookie")).toBe("session=test");
    expect(res.statusCode).toBe(200);
    expect(res.getHeader("set-cookie")).toEqual([
      "csrfToken=test-csrf; Path=/; Secure; SameSite=None",
    ]);
    expect(JSON.parse(res.body)).toEqual({ csrfToken: "test-csrf" });
  });

  it("forwards JSON request bodies and CSRF headers", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));

    const body = JSON.stringify({ email: "test@example.com", password: "not-a-real-password" });
    const req = makeRequest({
      url: "/api/proxy?__proxyPath=auth/register",
      method: "POST",
      headers: {
        origin: "https://tasknote-web.example",
        "content-type": "application/json",
        "x-csrf-token": "test-csrf",
      },
      body,
    });
    const res = makeResponse();

    await handler(req, res);

    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(Buffer.from(options.body).toString("utf8")).toBe(body);
    expect(options.headers.get("x-csrf-token")).toBe("test-csrf");
    expect(res.statusCode).toBe(201);
  });

  it("rejects unsafe paths without sending an upstream request", async () => {
    const req = makeRequest({ url: "/api/proxy?__proxyPath=../outside" });
    const res = makeResponse();

    await handler(req, res);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe("INVALID_API_PATH");
  });

  it("fails closed when the server-only proxy configuration is missing", async () => {
    vi.stubEnv("TASKNOTE_API_BYPASS_SECRET", "");
    const req = makeRequest({ url: "/api/proxy?__proxyPath=health" });
    const res = makeResponse();

    await handler(req, res);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).code).toBe("API_PROXY_NOT_CONFIGURED");
  });
});
