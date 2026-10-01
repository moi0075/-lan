import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { SyncStatus } from "./cloudProgress";
export interface AccountState {
  user: User | null;
  configured: boolean;
  status: SyncStatus;
  error: string;
  busy: boolean;
  recovering: boolean;
  clearError(): void;
  signInWithEmail(email: string, password: string): Promise<string>;
  signUpWithEmail(email: string, password: string): Promise<string>;
  resetPassword(email: string): Promise<string>;
  updatePassword(password: string): Promise<string>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  retry(): Promise<void>;
  useCloud(): Promise<void>;
}
export const AccountContext = createContext<AccountState | null>(null);
export function useAccount() {
  return useContext(AccountContext)!;
}
