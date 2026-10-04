import { describe, it, expect } from "vitest";
import { buildTaskQuery } from "./taskQuery.js";

describe("buildTaskQuery", () => {
  it("keeps listId when there is no search", () => {
    expect(buildTaskQuery({ listId: "abc" })).toEqual({ listId: "abc" });
  });

  it("drops listId while searching so search stays global", () => {
    expect(buildTaskQuery({ listId: "abc", q: "milk" })).toEqual({ q: "milk" });
    expect(
      buildTaskQuery({ listId: "abc", q: "milk" }).listId,
    ).toBeUndefined();
  });

  it("treats a whitespace-only search as no search", () => {
    expect(buildTaskQuery({ listId: "abc", q: "   " })).toEqual({
      listId: "abc",
    });
  });

  it("trims q", () => {
    expect(buildTaskQuery({ q: "  hello  " })).toEqual({ q: "hello" });
  });

  it("omits q entirely when empty", () => {
    expect(buildTaskQuery({ q: "" })).toEqual({});
    expect(buildTaskQuery({})).toEqual({});
  });

  it("preserves completed even when false", () => {
    expect(buildTaskQuery({ completed: false })).toEqual({ completed: false });
    expect(buildTaskQuery({ completed: true })).toEqual({ completed: true });
  });

  it("preserves sort", () => {
    expect(buildTaskQuery({ sort: "az" })).toEqual({ sort: "az" });
  });

  it("combines all parameters", () => {
    expect(
      buildTaskQuery({
        listId: "abc",
        completed: false,
        q: "  idea ",
        sort: "oldest",
      }),
    ).toEqual({ q: "idea", completed: false, sort: "oldest" });
  });

  it("returns query keys only, never task data", () => {
    const query = buildTaskQuery({ listId: "abc", completed: true });
    expect(Object.keys(query).sort()).toEqual(["completed", "listId"]);
  });

  it("does nothing with listId when completed and sort only", () => {
    expect(buildTaskQuery({ completed: true, sort: "newest" })).toEqual({
      completed: true,
      sort: "newest",
    });
  });
});
