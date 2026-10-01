import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Only the public browser key belongs here. Google secrets stay in Supabase.
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function authRedirectUrl() {
  // PKCE puts the code in the query string, leaving the app's hash routes intact.
  return `${window.location.origin}${window.location.pathname}`;
}

export async function googleIsEnabled(): Promise<boolean> {
  if (!url || !key) return false;
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Authentication unavailable");
  const settings = await response.json();
  return settings.external?.google === true;
}
