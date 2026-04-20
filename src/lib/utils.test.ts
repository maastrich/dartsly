import { describe, expect, it } from "vite-plus/test";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    const hide = false as boolean;
    expect(cn("a", hide && "b", null, undefined, "c")).toBe("a c");
  });

  it("supports conditional objects and arrays", () => {
    expect(cn("a", { b: true, c: false }, ["d", { e: true }])).toBe("a b d e");
  });

  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
  });
});
