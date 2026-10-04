import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Browser APIs jsdom does not implement. Applied before any test module runs.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Testing Library only auto-registers cleanup when `afterEach` is global,
  // and vitest globals are off, so both hooks are wired explicitly here.
  afterEach(cleanup);
  beforeEach(() => localStorage.clear());
}
