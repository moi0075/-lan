import type { User } from "@supabase/supabase-js";
import { GUEST_STORAGE_KEY, parseStore, type Store } from "../engine/storage";

export const SIGNUP_PROGRESS_KEY = "elan-signup-progress";
interface SignupIntent {
  method: "email" | "google";
  email?: string;
  userId?: string;
  startedAt: number;
  store: Store;
}
export function hasProgress(store: Store): boolean {
  const profile = store.profiles.find((p) => p.id === store.activeId);
  return (
    !!profile &&
    [profile, profile.naming].some(
      (track) =>
        !!track &&
        (track.learning.attempts > 0 ||
          Object.keys(track.learning.memory).length > 0),
    )
  );
}
export class SignupProgress {
  private pending: SignupIntent | null = null;
  clear() {
    this.pending = null;
    try {
      localStorage.removeItem(SIGNUP_PROGRESS_KEY);
    } catch {
      /* In-memory state still clears. */
    }
  }
  private persist(intent: SignupIntent) {
    this.pending = intent;
    try {
      localStorage.setItem(SIGNUP_PROGRESS_KEY, JSON.stringify(intent));
    } catch {
      /* Keep the choice available in this tab. */
    }
  }
  private read(): SignupIntent | null {
    try {
      const raw =
        this.pending ??
        JSON.parse(localStorage.getItem(SIGNUP_PROGRESS_KEY) || "null");
      if (!raw) return null;
      if (
        !["email", "google"].includes(raw.method) ||
        !Number.isFinite(raw.startedAt) ||
        Date.now() - raw.startedAt > 7 * 86400000 ||
        raw.startedAt > Date.now() + 60000 ||
        (raw.userId !== undefined && typeof raw.userId !== "string") ||
        (raw.method === "email" && typeof raw.email !== "string")
      )
        throw Error("Invalid signup intent");
      const store = parseStore(JSON.stringify(raw.store));
      if (!hasProgress(store)) throw Error("No guest progress");
      return { ...raw, store };
    } catch {
      this.clear();
      return null;
    }
  }
  begin(method: SignupIntent["method"], email?: string) {
    this.clear();
    try {
      const store = parseStore(localStorage.getItem(GUEST_STORAGE_KEY) || "");
      if (!hasProgress(store)) return;
      const profile = store.profiles.find((p) => p.id === store.activeId)!;
      // Transfer only the current journey, including both games, not legacy profiles.
      this.persist({
        method,
        email: email?.trim().toLowerCase(),
        startedAt: Date.now(),
        store: { ...store, profiles: [profile] },
      });
    } catch {
      /* An invalid or unavailable guest save must not block signup. */
    }
  }
  forUser(user: User): Store | null {
    const intent = this.read();
    if (!intent) return null;
    if (intent.userId) return intent.userId === user.id ? intent.store : null;
    const created = Date.parse(user.created_at);
    // A signup screen alone is not proof: Google may return an existing account,
    // and email signup may return an obfuscated user with no identities.
    const newlyCreated =
      Number.isFinite(created) &&
      created >= intent.startedAt &&
      created <= Date.now() + 60000 &&
      user.identities?.length !== 0;
    const matches =
      intent.method === "email"
        ? user.email?.toLowerCase() === intent.email
        : user.app_metadata.provider === "google";
    if (!newlyCreated || !matches) {
      this.clear();
      return null;
    }
    this.persist({ ...intent, userId: user.id });
    return intent.store;
  }
}
