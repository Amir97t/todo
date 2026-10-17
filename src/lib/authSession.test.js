import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeToAuthToken,
} from "./authSession.js";

afterEach(() => {
  clearAccessToken();
  vi.restoreAllMocks();
});

describe("in-memory access-token state", () => {
  it("starts without an access token", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores a token without using persistent browser storage", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    setAccessToken("access-token");
    expect(getAccessToken()).toBe("access-token");
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("rejects an empty or non-string token", () => {
    expect(() => setAccessToken("")).toThrow(TypeError);
    expect(() => setAccessToken("   ")).toThrow(TypeError);
    expect(() => setAccessToken(null)).toThrow(TypeError);
    expect(getAccessToken()).toBeNull();
  });

  it("notifies subscribers on set and clear", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthToken(listener);

    setAccessToken("first");
    clearAccessToken();

    expect(listener.mock.calls).toEqual([["first"], [null]]);
    unsubscribe();
  });

  it("does not notify when clearing an already-empty session", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthToken(listener);

    clearAccessToken();
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it("allows subscribers to unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthToken(listener);

    unsubscribe();
    setAccessToken("token");

    expect(listener).not.toHaveBeenCalled();
  });
});
