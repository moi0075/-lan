import { describe, it, expect } from "vitest";
import {
  newStore,
  parseStore,
  startSession,
  changeGameMode,
  progressFor,
  recordSessionAnswer,
} from "./storage";
import { recordAttempt } from "./learning";
import { countries } from "../data/catalog";
describe("portable local profiles", () => {
  it("keeps both variants and near misses independent across save, import and mode switches", () => {
    const s = newStore();
    const original = structuredClone(s.profiles[0].learning);
    s.profiles[0] = changeGameMode(s.profiles[0], "name");
    const naming = progressFor(s.profiles[0]);
    naming.learning = recordAttempt(
      naming.learning,
      countries,
      "IND",
      false,
      false,
      1000,
      true,
    );
    naming.session = recordSessionAnswer(naming.session!, {
      targetId: "IND",
      selectedId: null,
      correct: false,
      assisted: false,
      unlocked: 0,
      typedName: "indea",
      nameMatch: "close",
    });
    const loaded = parseStore(JSON.stringify(s));
    expect(loaded).toEqual(s);
    expect(loaded.profiles[0].learning).toEqual(original);
    expect(progressFor(loaded.profiles[0]).learning.memory.IND.nearMisses).toBe(
      1,
    );
    loaded.profiles[0] = changeGameMode(loaded.profiles[0], "place");
    expect(progressFor(loaded.profiles[0]).learning).toEqual(original);
    loaded.profiles[0] = changeGameMode(loaded.profiles[0], "name");
    expect(progressFor(loaded.profiles[0]).session?.feedback?.nameMatch).toBe(
      "close",
    );
  });
  it("rejects malformed variant state without accepting a near miss as a success", () => {
    const s = newStore();
    s.profiles[0] = changeGameMode(s.profiles[0], "name");
    s.profiles[0].naming!.session!.feedback = {
      targetId: "IND",
      selectedId: null,
      correct: true,
      assisted: false,
      unlocked: 0,
      typedName: "indea",
      nameMatch: "close",
    };
    expect(() => parseStore(JSON.stringify(s))).toThrow("Session invalide");
    const corrupt = JSON.parse(JSON.stringify(newStore()));
    corrupt.profiles[0].mode = "name";
    expect(() => parseStore(JSON.stringify(corrupt))).toThrow();
    corrupt.profiles[0].naming = { learning: {}, session: null };
    expect(() => parseStore(JSON.stringify(corrupt))).toThrow();
  });
  it("round-trips a valid versioned store and a live session", () => {
    const s = newStore();
    s.profiles[0].session = startSession(s.profiles[0]);
    expect(parseStore(JSON.stringify(s))).toEqual(s);
  });
  it("rejects unsupported formats, missing active profiles, duplicates and invalid counters", () => {
    expect(() => parseStore("{}")).toThrow();
    expect(() => parseStore("not json")).toThrow();
    for (const mutate of [
      (s: ReturnType<typeof newStore>) => {
        s.activeId = "missing";
      },
      (s: ReturnType<typeof newStore>) => {
        s.profiles.push(s.profiles[0]);
      },
      (s: ReturnType<typeof newStore>) => {
        s.profiles[0].learning.correct = 1;
      },
      (s: ReturnType<typeof newStore>) => {
        s.profiles[0].learning.unlocked = 999;
      },
    ]) {
      const s = newStore();
      mutate(s);
      expect(() => parseStore(JSON.stringify(s))).toThrow();
    }
  });
  it("rejects corrupt sessions and unknown country keys", () => {
    const s = newStore();
    s.profiles[0].session = startSession(s.profiles[0]);
    s.profiles[0].session.current.id = "NOT_A_COUNTRY";
    expect(() => parseStore(JSON.stringify(s))).toThrow();
    const t = newStore();
    t.profiles[0].learning.memory["__invalid__"] = {
      attempts: 0,
      correct: 0,
      errors: 0,
      streak: 0,
      acquired: false,
      lastSeen: 0,
      due: 0,
    };
    expect(() => parseStore(JSON.stringify(t))).toThrow();
  });
});

describe("continuous-session compatibility", () => {
  it("resumes a legacy completed expedition without discarding learning", () => {
    const s = newStore();
    s.profiles[0].session = startSession(s.profiles[0]);
    const r = s.profiles[0].session;
    r.answers = Array.from({ length: 10 }, () => ({
      targetId: "IND",
      selectedId: "IND",
      correct: true,
      assisted: false,
      unlocked: 0,
    }));
    r.feedback = r.answers[9];
    r.finished = true;
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.profiles[0].session.answeredCount;
    delete legacy.profiles[0].session.hintIds;
    const loaded = parseStore(JSON.stringify(legacy));
    expect(loaded.profiles[0].learning).toEqual(s.profiles[0].learning);
    expect(loaded.profiles[0].session).toMatchObject({
      answeredCount: 10,
      finished: false,
      feedback: null,
      hinted: false,
      hintIds: [],
    });
  });
  it("upgrades an active legacy hint to a stable set of five and rejects malformed sets", () => {
    const s = newStore();
    s.profiles[0].session = startSession(s.profiles[0]);
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.profiles[0].session.answeredCount;
    delete legacy.profiles[0].session.hintIds;
    legacy.profiles[0].session.hinted = true;
    const loaded = parseStore(JSON.stringify(legacy));
    expect(loaded.profiles[0].session?.hintIds).toHaveLength(5);
    expect(loaded.profiles[0].session?.hintIds).toContain("IND");
    loaded.profiles[0].session!.hintIds = ["IND", "IND", "IND", "IND", "IND"];
    expect(() => parseStore(JSON.stringify(loaded))).toThrow(
      "Session invalide",
    );
  });
  it("persists thousands of answers with a bounded session trail and no completion state", async () => {
    const { recordSessionAnswer } = await import("./storage");
    const s = newStore();
    let session = startSession(s.profiles[0]);
    for (let i = 0; i < 2000; i++)
      session = recordSessionAnswer(session, {
        targetId: "IND",
        selectedId: "IND",
        correct: true,
        assisted: false,
        unlocked: 0,
      });
    s.profiles[0].session = session;
    const loaded = parseStore(JSON.stringify(s));
    expect(loaded.profiles[0].session?.answeredCount).toBe(2000);
    expect(loaded.profiles[0].session?.answers).toHaveLength(10);
    expect(loaded.profiles[0].session?.finished).toBe(false);
  });
});
