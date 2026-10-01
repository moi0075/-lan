import {
  emptyLearning,
  selectNext,
  type LearningState,
  type Selection,
} from "./learning";
import { countries } from "../data/catalog";
import { candidateCountries } from "./hints";
import type { NameMatch } from "./nameAnswer";
export type GameMode = "place" | "name";
export interface Answer {
  targetId: string;
  selectedId: string | null;
  correct: boolean;
  assisted: boolean;
  unlocked: number;
  typedName?: string;
  nameMatch?: NameMatch;
}
export interface Session {
  current: Selection;
  answers: Answer[];
  answeredCount: number;
  hintIds: string[];
  feedback: Answer | null;
  hinted: boolean;
  /** Kept for compatibility with earlier version-1 backups; always false after loading. */
  finished: boolean;
}
export interface ProgressTrack {
  learning: LearningState;
  session: Session | null;
}
export interface Profile extends ProgressTrack {
  id: string;
  name: string;
  createdAt: number;
  mode?: GameMode;
  naming?: ProgressTrack;
}
export interface Store {
  version: 1;
  activeId: string;
  profiles: Profile[];
}
export const GUEST_STORAGE_KEY = "atlas-learning-v1";
export function makeProfile(name = "Explorateur"): Profile {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 32) || "Explorateur",
    createdAt: Date.now(),
    learning: emptyLearning(),
    session: null,
  };
}
export function newStore(): Store {
  const p = makeProfile();
  return { version: 1, activeId: p.id, profiles: [p] };
}
export function startSession(p: ProgressTrack): Session {
  return {
    current: selectNext(p.learning, countries),
    answers: [],
    answeredCount: 0,
    hintIds: [],
    feedback: null,
    hinted: false,
    finished: false,
  };
}
/** Keep a bounded recent trail while allowing a continuous, unbounded-length session. */
export function recordSessionAnswer(
  session: Session,
  feedback: Answer,
): Session {
  return {
    ...session,
    answeredCount: session.answeredCount + 1,
    answers: [...session.answers, feedback].slice(-10),
    feedback,
    finished: false,
  };
}
export function nextSessionQuestion(profile: ProgressTrack): Session {
  return {
    ...startSession(profile),
    answers: profile.session?.answers || [],
    answeredCount: profile.session?.answeredCount || 0,
  };
}
export function progressFor(profile: Profile): ProgressTrack {
  return profile.mode === "name" && profile.naming ? profile.naming : profile;
}
export function changeGameMode(profile: Profile, mode: GameMode): Profile {
  if (mode === "name" && !profile.naming) {
    const naming: ProgressTrack = { learning: emptyLearning(), session: null };
    naming.session = startSession(naming);
    return { ...profile, mode, naming };
  }
  return { ...profile, mode };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const ids = new Set(countries.map((c) => c.id));
const reasons = new Set(["discovery", "practice", "repair", "review"]);
const answer = (a: unknown): a is Answer =>
  object(a) &&
  typeof a.targetId === "string" &&
  ids.has(a.targetId) &&
  (a.selectedId === null ||
    (typeof a.selectedId === "string" &&
      (ids.has(a.selectedId) || a.selectedId.startsWith("territory:")))) &&
  typeof a.correct === "boolean" &&
  typeof a.assisted === "boolean" &&
  integer(a.unlocked) &&
  a.unlocked <= countries.length &&
  (a.typedName === undefined ||
    (typeof a.typedName === "string" && a.typedName.length <= 100)) &&
  (a.nameMatch === undefined ||
    (["exact", "close", "incorrect"].includes(String(a.nameMatch)) &&
      typeof a.typedName === "string" &&
      a.correct === (a.nameMatch === "exact")));
/** Treat stored data as untrusted. Never write it before full validation. */
export function parseStore(text: string): Store {
  if (text.length > 10_000_000)
    throw Error("Ce fichier est trop volumineux (10 Mo maximum).");
  let s: unknown;
  try {
    s = JSON.parse(text);
  } catch {
    throw Error("Ce fichier n’est pas un fichier JSON valide.");
  }
  if (
    !object(s) ||
    s.version !== 1 ||
    !Array.isArray(s.profiles) ||
    !s.profiles.length ||
    s.profiles.length > 30 ||
    typeof s.activeId !== "string"
  )
    throw Error("Format de sauvegarde Élan invalide.");
  const used = new Set<string>();
  for (const p of s.profiles) {
    if (
      !object(p) ||
      typeof p.id !== "string" ||
      used.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 32 ||
      !finite(p.createdAt) ||
      !object(p.learning)
    )
      throw Error("Profil invalide.");
    used.add(p.id);
    if (p.mode !== undefined && p.mode !== "place" && p.mode !== "name")
      throw Error("Variante invalide.");
    if (
      (p.naming !== undefined && !object(p.naming)) ||
      (p.mode === "name" && !p.naming)
    )
      throw Error("Progression de la variante invalide.");
    const tracks = [p];
    if (object(p.naming)) tracks.push(p.naming);
    for (const track of tracks) {
      if (!object(track.learning)) throw Error("Progression invalide.");
      const l = track.learning;
      if (
        !integer(l.unlocked) ||
        l.unlocked < 5 ||
        l.unlocked > countries.length ||
        (l.unlocked !== 197 && l.unlocked % 5 !== 0) ||
        !object(l.memory) ||
        !Array.isArray(l.history) ||
        l.history.length > 3000 ||
        !object(l.daily) ||
        !integer(l.xp) ||
        !integer(l.attempts) ||
        !integer(l.correct) ||
        l.correct > l.attempts
      )
        throw Error("Progression invalide.");
      for (const [id, m] of Object.entries(l.memory))
        if (
          !ids.has(id) ||
          countries.findIndex((c) => c.id === id) >= l.unlocked ||
          !object(m) ||
          !["attempts", "correct", "errors", "streak"].every((k) =>
            integer(m[k]),
          ) ||
          !finite(m.lastSeen) ||
          !finite(m.due) ||
          typeof m.acquired !== "boolean" ||
          (m.nearMisses !== undefined &&
            (!integer(m.nearMisses) || m.nearMisses > Number(m.errors))) ||
          (m.lastWasClose !== undefined &&
            typeof m.lastWasClose !== "boolean") ||
          Number(m.correct) + Number(m.errors) !== m.attempts ||
          Number(m.streak) > Number(m.correct)
        )
          throw Error("Données de mémorisation invalides.");
      for (const a of l.history)
        if (
          !object(a) ||
          typeof a.itemId !== "string" ||
          !ids.has(a.itemId) ||
          typeof a.correct !== "boolean" ||
          typeof a.assisted !== "boolean" ||
          (a.near !== undefined &&
            (typeof a.near !== "boolean" ||
              (a.near && (a.correct || a.assisted)))) ||
          !finite(a.at)
        )
          throw Error("Historique invalide.");
      for (const [day, a] of Object.entries(l.daily))
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
          !object(a) ||
          !integer(a.attempts) ||
          !integer(a.correct) ||
          a.correct > a.attempts
        )
          throw Error("Activité invalide.");
      if (track.session !== null) {
        const r = track.session;
        if (
          !object(r) ||
          !object(r.current) ||
          typeof r.current.id !== "string" ||
          !ids.has(r.current.id) ||
          countries.findIndex(
            (c) => c.id === (r.current as Record<string, unknown>).id,
          ) >= l.unlocked ||
          typeof r.current.reason !== "string" ||
          !reasons.has(r.current.reason) ||
          !Array.isArray(r.answers) ||
          r.answers.length > 10 ||
          !r.answers.every(answer) ||
          (r.feedback !== null && !answer(r.feedback)) ||
          typeof r.hinted !== "boolean" ||
          typeof r.finished !== "boolean" ||
          (r.finished && r.answers.length !== 10) ||
          (r.answeredCount !== undefined &&
            (!integer(r.answeredCount) ||
              r.answeredCount < r.answers.length)) ||
          (r.hintIds !== undefined &&
            (!Array.isArray(r.hintIds) ||
              !r.hintIds.every((id) => typeof id === "string" && ids.has(id)) ||
              (r.hinted
                ? r.hintIds.length !== 5 ||
                  new Set(r.hintIds).size !== 5 ||
                  !r.hintIds.includes(r.current.id)
                : r.hintIds.length !== 0)))
        )
          throw Error("Session invalide.");
        // Upgrade existing saves without discarding learning or reopening a completion screen.
        r.answeredCount ??= r.answers.length;
        r.hintIds ??= r.hinted
          ? candidateCountries(
              countries,
              String(r.current.id),
              Number(r.answeredCount) + (r.feedback ? 0 : 1),
            )
          : [];
        if (r.finished)
          track.session = nextSessionQuestion(
            track as unknown as ProgressTrack,
          );
      }
    }
  }
  if (!used.has(s.activeId)) throw Error("Profil actif introuvable.");
  return s as unknown as Store;
}
export function loadStore(key = GUEST_STORAGE_KEY): {
  store: Store;
  error?: string;
} {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    return { store: raw ? parseStore(raw) : newStore() };
  } catch {
    if (raw) {
      try {
        localStorage.setItem(`${key}-recovery`, raw);
      } catch {
        /* Storage may be unavailable. */
      }
    }
    return {
      store: newStore(),
      error: raw
        ? "La sauvegarde est invalide. Une copie de récupération a été conservée si le stockage le permet."
        : "Le stockage local est inaccessible. Vos dernières réponses ne pourront pas être sauvegardées sur cet appareil.",
    };
  }
}
export function saveStore(s: Store, key = GUEST_STORAGE_KEY): void {
  localStorage.setItem(key, JSON.stringify(s));
}
