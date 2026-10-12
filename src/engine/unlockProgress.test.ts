import { describe, expect, it } from "vitest";
import { emptyLearning, emptyMemory, recordAttempt } from "./learning";
import { unlockProgress } from "./unlockProgress";
const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
describe("progress toward the actual next unlock", () => {
  it("advances on unaided recalls and loses an unfinished streak on errors, near misses or hints", () => {
    let state = emptyLearning();
    expect(unlockProgress(state, items).percent).toBe(0);
    state = recordAttempt(state, items, "0", true);
    state = recordAttempt(state, items, "0", true);
    expect(unlockProgress(state, items).percent).toBeCloseTo((100 * 2) / 15);
    for (const [correct, assisted, near] of [
      [false, false, false],
      [false, false, true],
      [true, true, false],
    ]) {
      expect(
        unlockProgress(
          recordAttempt(state, items, "0", correct, assisted, 0, near),
          items,
        ).percent,
      ).toBe(0);
    }
  });
  it("retains acquisition credit after a lapse, matching the unlock engine", () => {
    let state = emptyLearning();
    for (let i = 0; i < 3; i++) state = recordAttempt(state, items, "0", true);
    const before = unlockProgress(state, items).percent;
    state = recordAttempt(state, items, "0", false);
    expect(unlockProgress(state, items).percent).toBe(before);
  });
  it("starts a fresh bar after each unlock, handles the last two countries and completion", () => {
    let state = emptyLearning();
    for (const item of items.slice(0, 5))
      state.memory[item.id] = { ...emptyMemory(), acquired: true, streak: 3 };
    state = recordAttempt(state, items, "0", true);
    expect(state.unlocked).toBe(10);
    expect(unlockProgress(state, items)).toEqual({ percent: 0, nextCount: 2 });
    for (const item of items.slice(5, 10))
      state.memory[item.id] = { ...emptyMemory(), acquired: true, streak: 3 };
    state = recordAttempt(state, items, "5", true);
    expect(unlockProgress(state, items)).toEqual({
      percent: 100,
      nextCount: 0,
    });
  });
});
