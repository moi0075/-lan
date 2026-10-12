import {
  BATCH_SIZE,
  MASTERY_STREAK,
  type LearningItem,
  type LearningState,
} from "./learning";

/** Mirrors recordAttempt: acquisition is permanent, unfinished streaks can regress. */
export function unlockProgress(
  state: LearningState,
  items: readonly LearningItem[],
) {
  const unlocked = Math.min(state.unlocked, items.length);
  const nextCount = Math.min(BATCH_SIZE, items.length - unlocked);
  if (!nextCount) return { percent: 100, nextCount: 0 };
  const batchLength = Math.min(BATCH_SIZE, unlocked);
  const remaining = items.slice(0, unlocked).reduce((sum, item) => {
    const memory = state.memory[item.id];
    return (
      sum +
      (memory?.acquired
        ? 0
        : MASTERY_STREAK -
          Math.min(MASTERY_STREAK, Math.max(0, memory?.streak ?? 0)))
    );
  }, 0);
  const percent = batchLength
    ? Math.max(0, 1 - remaining / (batchLength * MASTERY_STREAK)) * 100
    : 0;
  return { percent, nextCount };
}
