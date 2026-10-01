import { supabase } from "../auth/supabase";

export type LeaderboardSort = "xp" | "mastered" | "accuracy" | "attempts";
export interface PublicPlayer {
  player_id: string;
  display_name: string;
}
export interface LeaderboardRow extends PublicPlayer {
  rank: number;
  xp: number;
  attempts: number;
  correct: number;
  mastered: number;
  item_count: number;
  accuracy: number | null;
}
export interface LeaderboardResult {
  rows: LeaderboardRow[];
  total: number;
  player_count: number;
  mine: LeaderboardRow | null;
}
export interface LeaderboardFilters {
  theme: string;
  game: string;
  search: string;
  sort: LeaderboardSort;
  offset: number;
  self: string | null;
}
export const PAGE_SIZE = 25;

export function publicNameError(name: string): string {
  const cleaned = name.trim();
  if (Array.from(cleaned).length < 2 || Array.from(cleaned).length > 32)
    return "Choisissez un pseudo de 2 à 32 caractères.";
  if (cleaned.includes("@") || /[\u0000-\u001f\u007f]/.test(cleaned))
    return "Utilisez un pseudo, sans adresse e-mail.";
  return "";
}

export async function readLeaderboard(
  filters: LeaderboardFilters,
  signal: AbortSignal,
): Promise<LeaderboardResult> {
  if (!supabase) throw Error("Classement indisponible.");
  const { data, error } = await supabase
    .rpc("learning_leaderboard", {
      p_theme: filters.theme || null,
      p_game: filters.game || null,
      p_search: filters.search.trim(),
      p_sort: filters.sort,
      p_offset: filters.offset,
      p_limit: PAGE_SIZE,
      p_self: filters.self,
    })
    .abortSignal(signal);
  if (error) throw error;
  if (!data || !Array.isArray(data.rows) || typeof data.total !== "number")
    throw Error("Classement indisponible.");
  return data as LeaderboardResult;
}

export async function publicIdentity(
  signal: AbortSignal,
  name?: string,
): Promise<PublicPlayer | null> {
  if (!supabase) throw Error("Compte indisponible.");
  const { data, error } = await supabase
    .rpc("my_leaderboard_identity", {
      p_name: name?.trim() ?? null,
    })
    .abortSignal(signal);
  if (error) throw error;
  return data as PublicPlayer | null;
}
