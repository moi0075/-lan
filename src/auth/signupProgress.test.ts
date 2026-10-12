import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { SignupProgress, SIGNUP_PROGRESS_KEY } from "./signupProgress";
import {
  newStore,
  saveStore,
  changeGameMode,
  GUEST_STORAGE_KEY,
} from "../engine/storage";
import { recordAttempt } from "../engine/learning";
import { countries } from "../data/catalog";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
afterEach(() => vi.restoreAllMocks());
function guest() {
  const store = newStore();
  const profile = changeGameMode(store.profiles[0], "name");
  profile.learning = recordAttempt(profile.learning, countries, "IND", true);
  profile.naming!.learning = recordAttempt(
    profile.naming!.learning,
    countries,
    "IND",
    true,
  );
  store.profiles = [profile];
  saveStore(store);
  return store;
}
function user(provider = "email", created = new Date().toISOString()) {
  return {
    id: "alice",
    email: "alice@example.test",
    created_at: created,
    app_metadata: { provider },
    identities: [{ provider }],
  } as User;
}
it("keeps both games and only the active guest journey through email confirmation and reload", () => {
  const store = guest();
  store.profiles.push(newStore().profiles[0]);
  saveStore(store);
  const registration = new SignupProgress();
  registration.begin("email", " Alice@example.test ");
  expect(registration.forUser(user())!.profiles).toEqual([store.profiles[0]]);
  const restored = new SignupProgress();
  expect(restored.forUser(user())!.profiles[0].naming!.learning.attempts).toBe(
    1,
  );
  expect(restored.forUser({ ...user(), id: "bob" })).toBeNull();
  expect(
    JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY)!).profiles,
  ).toHaveLength(2);
});
it("does not offer a transfer without an explicit signup intent or without progress", () => {
  guest();
  expect(new SignupProgress().forUser(user())).toBeNull();
  saveStore(newStore());
  const registration = new SignupProgress();
  registration.begin("email", "alice@example.test");
  expect(registration.forUser(user())).toBeNull();
});
it("recognizes a new Google account but rejects an existing Google account", () => {
  guest();
  const registration = new SignupProgress();
  registration.begin("google");
  expect(
    registration.forUser(user("google", "2020-01-01T00:00:00Z")),
  ).toBeNull();
  registration.begin("google");
  expect(registration.forUser(user("google"))).not.toBeNull();
});
it("rejects obfuscated existing-email signup responses and another email", () => {
  guest();
  const registration = new SignupProgress();
  registration.begin("email", "alice@example.test");
  expect(registration.forUser({ ...user(), identities: [] })).toBeNull();
  registration.begin("email", "alice@example.test");
  expect(
    registration.forUser({ ...user(), email: "bob@example.test" }),
  ).toBeNull();
});
it("does not offer again after a decision or a normal login clears the intent", () => {
  guest();
  const registration = new SignupProgress();
  registration.begin("email", "alice@example.test");
  registration.forUser(user());
  registration.clear();
  expect(new SignupProgress().forUser(user())).toBeNull();
  expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
});
it("ignores expired or corrupt registration snapshots", () => {
  const store = guest();
  localStorage.setItem(
    SIGNUP_PROGRESS_KEY,
    JSON.stringify({
      method: "google",
      startedAt: Date.now() - 8 * 86400000,
      store,
    }),
  );
  expect(new SignupProgress().forUser(user("google"))).toBeNull();
  localStorage.setItem(SIGNUP_PROGRESS_KEY, "not json");
  expect(new SignupProgress().forUser(user())).toBeNull();
});

it("does not treat a just-created account as a new signup if it predates this attempt", () => {
  guest();
  const registration = new SignupProgress();
  const existing = user("google", new Date(Date.now() - 100).toISOString());
  registration.begin("google");
  expect(registration.forUser(existing)).toBeNull();
});
