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

  // jsdom does not implement the Web Locks API, which migration now requires
  // before touching any data. This shim keeps the real code path exercised;
  // it serialises per lock name within this window only and therefore does
  // NOT prove cross-tab exclusion — see migration-concurrency.test.js.
  if (window.navigator && !window.navigator.locks) {
    const queues = new Map();

    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      writable: true,
      value: {
        request(name, callback) {
          const tail = queues.get(name) || Promise.resolve();
          const result = tail.then(() =>
            callback({ name, mode: "exclusive", aborted: false }),
          );
          // Re-arm regardless of outcome so a rejection cannot wedge the queue.
          queues.set(
            name,
            result.then(
              () => undefined,
              () => undefined,
            ),
          );
          return result;
        },
      },
    });
  }

  // Testing Library only auto-registers cleanup when `afterEach` is global,
  // and vitest globals are off, so both hooks are wired explicitly here.
  afterEach(cleanup);
  beforeEach(() => localStorage.clear());
}
