import { Buffer } from "node:buffer";
import process from "node:process";

const API_PREFIX = "/api/v1/";
const ALLOWED_UPSTREAM_HOST =
  "tasknote-api-git-feat-auth-cors-d68308-amirs-projects-16941eb8.vercel.app";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "origin",
  "x-csrf-token",
];
const RESPONSE_HEADER_ALLOWLIST = ["content-type", "etag", "last-modified", "vary"];
const MAX_BODY_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 12_000;

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

function resolveProxyPath(reqUrl) {
  const incomingUrl = new URL(reqUrl || "/", "https://tasknote-proxy.invalid");
  const proxyPath = incomingUrl.searchParams.get("__proxyPath");

  if (
    typeof proxyPath !== "string" ||
    proxyPath.length === 0 ||
    proxyPath.startsWith("/") ||
    proxyPath.includes("\\") ||
    !/^[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(proxyPath)
  ) {
    return null;
  }

  const segments = proxyPath.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const targetUrl = new URL(API_PREFIX + proxyPath, "https://" + ALLOWED_UPSTREAM_HOST);

  for (const [key, value] of incomingUrl.searchParams.entries()) {
    if (key !== "__proxyPath") {
      targetUrl.searchParams.append(key, value);
    }
  }

  return targetUrl;
}

async function readRequestBody(req) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader("allow", [...ALLOWED_METHODS].join(", "));
    return sendJson(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "This HTTP method is not supported by the API proxy.",
    });
  }

  const upstreamValue = process.env.TASKNOTE_API_UPSTREAM;
  const bypassSecret = process.env.TASKNOTE_API_BYPASS_SECRET;

  if (!upstreamValue || !bypassSecret) {
    return sendJson(res, 503, {
      code: "API_PROXY_NOT_CONFIGURED",
      message: "The Preview API proxy is not configured.",
    });
  }

  let upstream;
  try {
    upstream = new URL(upstreamValue);
  } catch {
    return sendJson(res, 500, {
      code: "API_PROXY_CONFIGURATION_ERROR",
      message: "The API proxy configuration is invalid.",
    });
  }

  if (upstream.protocol !== "https:" || upstream.hostname !== ALLOWED_UPSTREAM_HOST) {
    return sendJson(res, 500, {
      code: "API_PROXY_UPSTREAM_NOT_ALLOWED",
      message: "The configured API upstream is not allowed.",
    });
  }

  const targetUrl = resolveProxyPath(req.url);
  if (!targetUrl) {
    return sendJson(res, 400, {
      code: "INVALID_API_PATH",
      message: "The requested API path is invalid.",
    });
  }

  const headers = new Headers();
  for (const name of REQUEST_HEADER_ALLOWLIST) {
    const value = req.headers?.[name];
    if (typeof value === "string" && value.length > 0) {
      headers.set(name, value);
    }
  }

  // The browser talks to this frontend origin. Preserve Origin for the
  // backend's own allowlist and forward auth/CSRF cookies only server-side.
  headers.set("x-vercel-protection-bypass", bypassSecret);

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await readRequestBody(req);
    } catch (error) {
      if (error?.statusCode === 413) {
        return sendJson(res, 413, {
          code: "REQUEST_BODY_TOO_LARGE",
          message: "The request body is too large.",
        });
      }
      return sendJson(res, 400, {
        code: "INVALID_REQUEST_BODY",
        message: "The request body could not be read.",
      });
    }

    if (body.byteLength === 0) body = undefined;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return sendJson(res, timedOut ? 504 : 502, {
      code: timedOut ? "API_UPSTREAM_TIMEOUT" : "API_UPSTREAM_UNAVAILABLE",
      message: timedOut
        ? "The API request timed out."
        : "The API service could not be reached.",
    });
  }

  res.statusCode = upstreamResponse.status;
  res.setHeader("cache-control", "no-store");

  for (const name of RESPONSE_HEADER_ALLOWLIST) {
    const value = upstreamResponse.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  // Set-Cookie must be forwarded as separate headers so CSRF and refresh
  // cookies are stored against the frontend origin and its /api/v1/auth path.
  const cookies =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : [];
  if (cookies.length > 0) {
    res.setHeader("set-cookie", cookies);
  } else {
    const singleCookie = upstreamResponse.headers.get("set-cookie");
    if (singleCookie) res.setHeader("set-cookie", singleCookie);
  }

  if (req.method === "HEAD" || upstreamResponse.status === 204 || upstreamResponse.status === 304) {
    return res.end();
  }

  const responseBytes = Buffer.from(await upstreamResponse.arrayBuffer());
  return res.end(responseBytes);
}
