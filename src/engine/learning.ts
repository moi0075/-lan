/** Domain-only adaptive learning engine: no React, map, browser or storage dependency. */
export interface LearningItem {
  id: string;
}
export interface Memory {
  attempts: number;
  correct: number;
  errors: number;
  nearMisses?: number;
  lastWasClose?: boolean;
  streak: number;
  acquired: boolean;
  lastSeen: number;
  due: number;
}
export interface Attempt {
  itemId: string;
  correct: boolean;
  assisted: boolean;
  at: number;
  near?: boolean;
}
export interface DailyActivity {
  attempts: number;
  correct: number;
}
export interface LearningState {
  unlocked: number;
  memory: Record<string, Memory>;
  history: Attempt[];
  daily: Record<string, DailyActivity>;
  xp: number;
  attempts: number;
  correct: number;
}
export type Reason = "discovery" | "practice" | "repair" | "review";
export interface Selection {
  id: string;
  reason: Reason;
}
export const BATCH_SIZE = 5;
export const MASTERY_STREAK = 3;
export const emptyLearning = (): LearningState => ({
  unlocked: BATCH_SIZE,
  memory: {},
  history: [],
  daily: {},
  xp: 0,
  attempts: 0,
  correct: 0,
});
export const emptyMemory = (): Memory => ({
  attempts: 0,
  correct: 0,
  errors: 0,
  streak: 0,
  acquired: false,
  lastSeen: 0,
  due: 0,
});
export function dateKey(time = Date.now()): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function isMastered(m?: Memory): boolean {
  return !!m?.acquired && m.streak >= MASTERY_STREAK;
}
export function statusOf(
  m?: Memory,
): "new" | "learning" | "review" | "mastered" {
  return !m?.attempts
    ? "new"
    : isMastered(m)
      ? "mastered"
      : m.errors > 0 && m.streak < 3
        ? "review"
        : "learning";
}
const intervals = [
  0,
  3 * 60_000,
  60 * 60_000,
  24 * 60 * 60_000,
  3 * 24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  14 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000,
];
/** Three consecutive unaided recalls establish acquisition; hints never advance mastery. */
export function recordAttempt(
  state: LearningState,
  items: readonly LearningItem[],
  itemId: string,
  correct: boolean,
  assisted = false,
  now = Date.now(),
  nearMiss = false,
): LearningState {
  const index = items.findIndex((i) => i.id === itemId);
  if (index < 0 || index >= state.unlocked)
    throw new Error("Item is not unlocked");
  const prior = state.memory[itemId] || emptyMemory();
  const success = correct && !assisted;
  const near = !correct && !assisted && nearMiss;
  const streak = success ? prior.streak + 1 : 0;
  const memory = {
    ...state.memory,
    [itemId]: {
      attempts: prior.attempts + 1,
      correct: prior.correct + (correct ? 1 : 0),
      errors: prior.errors + (correct ? 0 : 1),
      ...(near || prior.nearMisses
        ? {
            nearMisses: (prior.nearMisses || 0) + (near ? 1 : 0),
            lastWasClose: near,
          }
        : {}),
      streak,
      acquired: prior.acquired || streak >= MASTERY_STREAK,
      lastSeen: now,
      due:
        now +
        (success
          ? intervals[Math.min(streak, intervals.length - 1)]
          : near
            ? 120_000
            : 60_000),
    },
  };
  let unlocked = Math.min(state.unlocked, items.length);
  // Monotonic unlocks: a lapse never removes already discovered content.
  if (items.slice(0, unlocked).every((item) => memory[item.id]?.acquired))
    unlocked = Math.min(items.length, unlocked + BATCH_SIZE);
  const key = dateKey(now),
    today = state.daily[key] || { attempts: 0, correct: 0 };
  return {
    ...state,
    memory,
    unlocked,
    history: [
      ...state.history,
      { itemId, correct, assisted, at: now, ...(near ? { near: true } : {}) },
    ].slice(-3000),
    daily: {
      ...state.daily,
      [key]: {
        attempts: today.attempts + 1,
        correct: today.correct + (correct ? 1 : 0),
      },
    },
    xp:
      state.xp +
      (success ? 10 : correct || near ? 3 : 0) +
      (success && !prior.acquired && streak >= 3 ? 20 : 0),
    attempts: state.attempts + 1,
    correct: state.correct + (correct ? 1 : 0),
  };
}
export function selectionWeight(m: Memory | undefined, now: number): number {
  if (!m?.attempts) return 4;
  const age = Math.max(0, now - m.lastSeen),
    span = Math.max(60_000, m.due - m.lastSeen);
  const overdue = m.due <= now ? Math.min(5, 1 + (now - m.due) / span) : 0;
  return (
    (isMastered(m) ? 0.25 : 2) +
    Math.min(
      4,
      ((m.errors - (m.nearMisses || 0) * 0.5) / Math.max(1, m.attempts)) * 5,
    ) +
    (m.streak === 0 ? 2 : 0) +
    overdue +
    Math.min(2, age / 86_400_000)
  );
}
/** First encounter follows curriculum order; repair and maintenance are interleaved. */
export function selectNext(
  state: LearningState,
  items: readonly LearningItem[],
  now = Date.now(),
  random: () => number = Math.random,
): Selection {
  const unlocked = items.slice(0, state.unlocked);
  if (!unlocked.length) throw new Error("Curriculum is empty");
  // A near miss is still an error, but leave four intervening prompts before
  // reviewing it, versus two for a country the learner did not recognise.
  const recent = [
    ...state.history.slice(-2).map((a) => a.itemId),
    ...state.history
      .slice(-4)
      .filter((a) => a.near)
      .map((a) => a.itemId),
  ];
  let pool = unlocked.filter((i) => !recent.includes(i.id));
  if (!pool.length) pool = unlocked.filter((i) => i.id !== recent.at(-1));
  if (!pool.length) pool = unlocked;
  const reason = (id: string): Reason =>
    !state.memory[id]?.attempts
      ? "discovery"
      : isMastered(state.memory[id])
        ? "review"
        : state.memory[id].errors > 0
          ? "repair"
          : "practice";
  // Return a failed/assisted item after two intervening prompts, without rote back-to-back guesses.
  const repair = pool
    .filter((i) => {
      const m = state.memory[i.id];
      return m?.attempts && m.streak === 0;
    })
    .sort(
      (a, b) =>
        Number(!!state.memory[a.id].lastWasClose) -
          Number(!!state.memory[b.id].lastWasClose) ||
        state.memory[a.id].lastSeen - state.memory[b.id].lastSeen,
    );
  const mastered = pool.filter((i) => isMastered(state.memory[i.id]));
  const due = mastered
    .filter((i) => state.memory[i.id].due <= now)
    .sort((a, b) => state.memory[a.id].due - state.memory[b.id].due);
  if (due.length) return { id: due[0].id, reason: "review" };
  // One maintenance opportunity every fourth prompt, even before the due date.
  if (state.attempts > 0 && state.attempts % 4 === 3 && mastered.length) {
    const id = mastered.sort(
      (a, b) => state.memory[a.id].lastSeen - state.memory[b.id].lastSeen,
    )[0].id;
    return { id, reason: "review" };
  }
  if (repair.length) return { id: repair[0].id, reason: "repair" };
  const unseen = pool.find((i) => !state.memory[i.id]?.attempts);
  if (unseen) return { id: unseen.id, reason: "discovery" };
  const weights = pool.map((i) => selectionWeight(state.memory[i.id], now));
  let pick =
    Math.max(0, Math.min(0.999999, random())) *
    weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick < 0) return { id: pool[i].id, reason: reason(pool[i].id) };
  }
  const id = pool[pool.length - 1].id;
  return { id, reason: reason(id) };
}
export function activityStreak(
  daily: Record<string, DailyActivity>,
  now = Date.now(),
): number {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if (!daily[dateKey(d.getTime())]?.attempts) d.setDate(d.getDate() - 1);
  let n = 0;
  while (daily[dateKey(d.getTime())]?.attempts) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
