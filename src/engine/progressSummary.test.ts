import { describe, expect, it } from "vitest";
import { allGames, learningForGame } from "../catalog/learningCatalog";
import { newStore } from "./storage";
import { dateKey, emptyLearning, recordAttempt } from "./learning";
import { summarizeProgress } from "./progressSummary";

describe("progress across independent games", () => {
  it("includes unstarted games without creating a new saved track", () => {
    const profile = newStore().profiles[0];
    const before = structuredClone(profile);
    const summary = summarizeProgress(
      allGames.map((game) => ({
        items: game.items,
        learning: learningForGame(profile, game),
      })),
    );
    expect(summary).toMatchObject({
      total: 394,
      mastered: 0,
      percent: 0,
      accuracy: null,
      attempts: 0,
    });
    expect(profile).toEqual(before);
    expect(profile.naming).toBeUndefined();
  });

  it("counts each game separately, weights accuracy by answers, and merges days", () => {
    const items = [{ id: "first" }, { id: "second" }];
    let placement = emptyLearning(),
      naming = emptyLearning();
    for (let i = 0; i < 3; i++)
      placement = recordAttempt(
        placement,
        items,
        "first",
        true,
        false,
        1000 + i,
      );
    for (let i = 0; i < 4; i++)
      naming = recordAttempt(
        naming,
        items,
        "first",
        i === 0,
        false,
        1000 + i,
        i === 3,
      );
    const summary = summarizeProgress([
      { items, learning: placement },
      { items, learning: naming },
    ]);
    expect(summary).toMatchObject({
      total: 4,
      mastered: 1,
      learning: 1,
      percent: 25,
      attempts: 7,
      correct: 4,
      accuracy: 57,
      nearMisses: 1,
    });
    expect(summary.daily[dateKey(1000)]).toEqual({ attempts: 7, correct: 4 });
    placement = recordAttempt(placement, items, "first", false, false, 2000);
    expect(
      summarizeProgress([
        { items, learning: placement },
        { items, learning: naming },
      ]),
    ).toMatchObject({ mastered: 0, learning: 2, percent: 0 });
  });
});
