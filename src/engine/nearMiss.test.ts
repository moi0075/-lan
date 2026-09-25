import { describe, expect, it } from "vitest";
import {
  emptyLearning,
  recordAttempt,
  selectionWeight,
  selectNext,
} from "./learning";

const items = ["FRA", "IND", "CHN", "USA", "IDN"].map((id) => ({ id }));
describe("partial recall", () => {
  it("counts close spelling as an error, gives no mastery, but schedules it more gently", () => {
    const start = emptyLearning();
    const near = recordAttempt(start, items, "FRA", false, false, 1000, true);
    const wrong = recordAttempt(start, items, "FRA", false, false, 1000);
    expect(near).toMatchObject({ attempts: 1, correct: 0, unlocked: 5 });
    expect(near.memory.FRA).toMatchObject({
      errors: 1,
      nearMisses: 1,
      lastWasClose: true,
      streak: 0,
      acquired: false,
    });
    expect(near.memory.FRA.due).toBeGreaterThan(wrong.memory.FRA.due);
    expect(selectionWeight(near.memory.FRA, 1000)).toBeLessThan(
      selectionWeight(wrong.memory.FRA, 1000),
    );
    expect(near.history[0]).toMatchObject({ correct: false, near: true });
  });
  it("leaves four intervening questions after a near miss, versus two after a complete error", () => {
    let near = recordAttempt(
      emptyLearning(),
      items,
      "FRA",
      false,
      false,
      1000,
      true,
    );
    let wrong = recordAttempt(
      emptyLearning(),
      items,
      "FRA",
      false,
      false,
      1000,
    );
    for (let i = 1; i <= 4; i++) {
      expect(selectNext(near, items, 1000 + i).id).not.toBe("FRA");
      near = recordAttempt(near, items, items[i].id, true, false, 1000 + i);
      if (i <= 2)
        wrong = recordAttempt(wrong, items, items[i].id, true, false, 1000 + i);
    }
    expect(selectNext(near, items, 1010)).toEqual({
      id: "FRA",
      reason: "repair",
    });
    expect(selectNext(wrong, items, 1010)).toEqual({
      id: "FRA",
      reason: "repair",
    });
  });
  it("breaks the exact-answer streak and never unlocks a batch using near misses", () => {
    let state = emptyLearning();
    for (const item of items)
      for (let i = 0; i < 3; i++)
        state = recordAttempt(
          state,
          items,
          item.id,
          false,
          false,
          1000 + i,
          true,
        );
    expect(state.unlocked).toBe(5);
    expect(
      Object.values(state.memory).every((m) => !m.acquired && m.streak === 0),
    ).toBe(true);
    state = recordAttempt(state, items, "FRA", true, false, 2000);
    state = recordAttempt(state, items, "FRA", true, false, 2001);
    state = recordAttempt(state, items, "FRA", false, false, 2002, true);
    expect(state.memory.FRA.streak).toBe(0);
  });
});
