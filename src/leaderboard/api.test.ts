import { describe, expect, it } from "vitest";
import { publicNameError } from "./api";
describe("public alias validation", () => {
  it("permits accents, spaces and Unicode aliases", () => {
    expect(publicNameError("  Téo Curieux  ")).toBe("");
    expect(publicNameError("🌱".repeat(32))).toBe("");
  });
  it("rejects email addresses, control characters and invalid lengths", () => {
    expect(publicNameError("t@example.test")).not.toBe("");
    expect(publicNameError("Téo\u0000")).not.toBe("");
    expect(publicNameError("  A  ")).not.toBe("");
    expect(publicNameError("🌱".repeat(33))).not.toBe("");
  });
});
