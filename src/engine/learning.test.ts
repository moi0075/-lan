import { describe, it, expect } from "vitest";
import {
  activityStreak,
  dateKey,
  emptyLearning,
  emptyMemory,
  isMastered,
  recordAttempt,
  selectNext,
  selectionWeight,
} from "./learning";
import { countries } from "../data/catalog";
import shapes from "../data/map.json";
const NOW = new Date("2026-09-17T12:00:00").getTime();
const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
describe("adaptive curriculum", () => {
  it("starts with the five most populous countries, with 197 unique reachable entries", () => {
    expect(countries).toHaveLength(197);
    expect(new Set(countries.map((c) => c.id)).size).toBe(197);
    expect(countries.slice(0, 5).map((c) => c.id)).toEqual([
      "IND",
      "CHN",
      "USA",
      "IDN",
      "PAK",
    ]);
    expect(
      countries.every(
        (c, i) => !i || countries[i - 1].population >= c.population,
      ),
    ).toBe(true);
    for (const c of countries) {
      expect(c.point.every(Number.isFinite)).toBe(true);
      expect(c.small || shapes.some((s) => s.id === c.mapId && s.d)).toBe(true);
    }
  });
  it("rejects a locked or unknown item", () => {
    expect(() => recordAttempt(emptyLearning(), items, "5", true)).toThrow();
    expect(() => recordAttempt(emptyLearning(), items, "999", true)).toThrow();
  });
  it("requires three consecutive unassisted correct answers and resets after a mistake", () => {
    let s = emptyLearning();
    s = recordAttempt(s, items, "0", true, false, NOW);
    s = recordAttempt(s, items, "0", true, false, NOW);
    expect(isMastered(s.memory["0"])).toBe(false);
    s = recordAttempt(s, items, "0", false, false, NOW);
    expect(s.memory["0"].streak).toBe(0);
    for (let i = 0; i < 3; i++)
      s = recordAttempt(s, items, "0", true, false, NOW);
    expect(isMastered(s.memory["0"])).toBe(true);
    expect(s.memory["0"].errors).toBe(1);
    expect(s.memory["0"].due).toBe(NOW + 86400000);
  });
  it("never counts an assisted answer toward acquisition", () => {
    let s = emptyLearning();
    for (let i = 0; i < 6; i++)
      s = recordAttempt(s, items, "0", true, true, NOW);
    expect(isMastered(s.memory["0"])).toBe(false);
    expect(s.xp).toBe(18);
  });
  it("unlocks only after the entire group is acquired, handles final partial batch, and never relocks", () => {
    let s = emptyLearning();
    for (let id = 0; id < 4; id++)
      for (let n = 0; n < 3; n++)
        s = recordAttempt(s, items, String(id), true, false, NOW);
    expect(s.unlocked).toBe(5);
    for (let n = 0; n < 3; n++)
      s = recordAttempt(s, items, "4", true, false, NOW);
    expect(s.unlocked).toBe(10);
    s = recordAttempt(s, items, "0", false, false, NOW);
    expect(s.unlocked).toBe(10);
    for (let id = 5; id < 10; id++)
      for (let n = 0; n < 3; n++)
        s = recordAttempt(s, items, String(id), true, false, NOW);
    expect(s.unlocked).toBe(12);
    expect(s.memory["0"].acquired).toBe(true);
    expect(isMastered(s.memory["0"])).toBe(false);
  });
  it("discovers new countries in curriculum order", () => {
    let s = emptyLearning();
    for (let i = 0; i < 5; i++) {
      expect(selectNext(s, items, NOW).id).toBe(String(i));
      s = recordAttempt(s, items, String(i), true, false, NOW);
    }
  });
  it("spaces repairs by two intervening questions", () => {
    let s = recordAttempt(emptyLearning(), items, "0", false, false, NOW);
    expect(selectNext(s, items, NOW).id).toBe("1");
    s = recordAttempt(s, items, "1", true, false, NOW + 1);
    expect(selectNext(s, items, NOW + 1).id).toBe("2");
    s = recordAttempt(s, items, "2", true, false, NOW + 2);
    expect(selectNext(s, items, NOW + 2)).toEqual({
      id: "0",
      reason: "repair",
    });
  });
  it("weights errors and overdue reviews more heavily", () => {
    const strong = {
      ...emptyMemory(),
      attempts: 10,
      correct: 10,
      streak: 5,
      acquired: true,
      lastSeen: NOW,
      due: NOW + 86400000,
    };
    const weak = {
      ...strong,
      correct: 3,
      errors: 7,
      streak: 1,
      acquired: false,
    };
    expect(selectionWeight(weak, NOW)).toBeGreaterThan(
      selectionWeight(strong, NOW),
    );
    expect(selectionWeight(strong, NOW + 86400000 * 10)).toBeGreaterThan(
      selectionWeight(strong, NOW),
    );
  });
  it("revisits mastered countries every fourth opportunity and when due", () => {
    const s = emptyLearning();
    s.memory["0"] = {
      attempts: 3,
      correct: 3,
      errors: 0,
      streak: 3,
      acquired: true,
      lastSeen: NOW - 5000,
      due: NOW + 86400000,
    };
    s.attempts = 3;
    expect(selectNext(s, items, NOW)).toEqual({ id: "0", reason: "review" });
    s.attempts = 4;
    expect(selectNext(s, items, NOW + 86400001)).toEqual({
      id: "0",
      reason: "review",
    });
  });
  it("excludes the previous two questions across session boundaries", () => {
    let s = recordAttempt(emptyLearning(), items, "0", true, false, NOW);
    s = recordAttempt(s, items, "1", true, false, NOW);
    for (let i = 0; i < 100; i++)
      expect(["0", "1"]).not.toContain(selectNext(s, items, NOW).id);
  });
  it("eventually unlocks and masters all 197 countries in a deterministic successful journey", () => {
    let s = emptyLearning();
    let seed = 719;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (
      let i = 0;
      i < 3500 && !countries.every((c) => isMastered(s.memory[c.id]));
      i++
    ) {
      const q = selectNext(s, countries, NOW + i * 1000, random);
      s = recordAttempt(s, countries, q.id, true, false, NOW + i * 1000);
    }
    expect(s.unlocked).toBe(197);
    expect(countries.every((c) => isMastered(s.memory[c.id]))).toBe(true);
  });
  it("preserves all-time totals while bounding detailed history", () => {
    let s = emptyLearning();
    for (let i = 0; i < 3002; i++)
      s = recordAttempt(s, items, "0", true, false, NOW);
    expect(s.history.length).toBe(3000);
    expect(s.attempts).toBe(3002);
    expect(s.daily[dateKey(NOW)].attempts).toBe(3002);
  });
  it("counts a continuing streak before today’s first answer and breaks after a missed day", () => {
    const today = new Date(NOW),
      yesterday = new Date(NOW),
      before = new Date(NOW);
    yesterday.setDate(today.getDate() - 1);
    before.setDate(today.getDate() - 2);
    const daily = {
      [dateKey(yesterday.getTime())]: { attempts: 1, correct: 1 },
      [dateKey(before.getTime())]: { attempts: 1, correct: 1 },
    };
    expect(activityStreak(daily, NOW)).toBe(2);
    const later = new Date(NOW);
    later.setDate(later.getDate() + 1);
    expect(activityStreak(daily, later.getTime())).toBe(0);
  });
});
