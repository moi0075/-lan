import {
  BATCH_SIZE,
  isMastered,
  type DailyActivity,
  type LearningItem,
  type LearningState,
} from "./learning";

export interface ProgressSource {
  items: readonly LearningItem[];
  learning?: LearningState;
}

/** Each item in each game is a separate skill, including games not yet started. */
export function summarizeProgress(sources: readonly ProgressSource[]) {
  let total = 0,
    mastered = 0,
    unlocked = 0,
    learning = 0;
  let attempts = 0,
    correct = 0,
    xp = 0,
    nearMisses = 0;
  const daily: Record<string, DailyActivity> = {};
  for (const source of sources) {
    const state = source.learning;
    total += source.items.length;
    unlocked += Math.min(source.items.length, state?.unlocked ?? BATCH_SIZE);
    attempts += state?.attempts ?? 0;
    correct += state?.correct ?? 0;
    xp += state?.xp ?? 0;
    for (const item of source.items) {
      const memory = state?.memory[item.id];
      if (isMastered(memory)) mastered++;
      else if (memory?.attempts) learning++;
      nearMisses += memory?.nearMisses ?? 0;
    }
    for (const [key, activity] of Object.entries(state?.daily ?? {})) {
      const previous = daily[key] ?? { attempts: 0, correct: 0 };
      daily[key] = {
        attempts: previous.attempts + activity.attempts,
        correct: previous.correct + activity.correct,
      };
    }
  }
  return {
    total,
    mastered,
    unlocked,
    learning,
    attempts,
    correct,
    xp,
    nearMisses,
    daily,
    percent: total ? Math.round((mastered / total) * 1000) / 10 : 0,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
  };
}
export type ProgressSummary = ReturnType<typeof summarizeProgress>;
