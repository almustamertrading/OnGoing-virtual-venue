import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNext("/projects/abc?tab=finance#top")).toBe("/projects/abc?tab=finance#top");
    expect(safeNext("/settings/account?reset=1")).toBe("/settings/account?reset=1");
  });

  it.each([
    ["https://evil.example/x"],
    ["//evil.example/x"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["javascript:alert(1)"],
    ["/proj\nects"],
    [""],
    [undefined],
    [42],
  ])("rejects %j", (value) => {
    expect(safeNext(value)).toBe("/projects");
  });

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.example", "/login")).toBe("/login");
  });
});
