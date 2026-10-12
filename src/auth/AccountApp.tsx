import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import App from "../App";
import Modal from "../components/Modal";
import { SignupProgress } from "./signupProgress";
import { GUEST_STORAGE_KEY, type Store } from "../engine/storage";
import { supabase, authRedirectUrl, googleIsEnabled } from "./supabase";
import { AccountContext } from "./AccountContext";
import { accountKey, CloudProgress, progressRepository } from "./cloudProgress";

export default function AccountApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [boot, setBoot] = useState<{
    id: string;
    store: Store;
    epoch: number;
  } | null>(null);
  const [transfer, setTransfer] = useState<{
    userId: string;
    store: Store;
  } | null>(null);
  const signup = useRef(new SignupProgress());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [, repaint] = useState(0);
  const sync = useRef<CloudProgress | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recoveryKey = "elan-password-recovery";
  function rememberRecovery(id: string | null) {
    try {
      if (id) sessionStorage.setItem(recoveryKey, id);
      else sessionStorage.removeItem(recoveryKey);
    } catch {
      /* The live recovery flow still works without session storage. */
    }
  }
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (event === "PASSWORD_RECOVERY") {
          signup.current.clear();
          setTransfer(null);
          rememberRecovery(session?.user.id ?? null);
          setRecovering(true);
        } else if (event === "SIGNED_OUT") {
          rememberRecovery(null);
          setRecovering(false);
        } else if (event === "INITIAL_SESSION") {
          try {
            setRecovering(
              !!session &&
                sessionStorage.getItem(recoveryKey) === session.user.id,
            );
          } catch {
            /* Recovery remains driven by the auth event. */
          }
        }
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setError(
            "La connexion n’a pas pu être restaurée. Vous pouvez réessayer.",
          );
        setUser(data.session?.user ?? null);
        setAuthReady(true);
        const url = new URL(window.location.href);
        if (url.searchParams.has("error"))
          setError("Connexion annulée ou refusée. Vous pouvez réessayer.");
        for (const key of ["code", "error", "error_code", "error_description"])
          url.searchParams.delete(key);
        window.history.replaceState(null, "", url);
      })
      .catch(() => {
        if (active) {
          setError(
            "La connexion n’a pas pu être restaurée. Vous pouvez réessayer.",
          );
          setAuthReady(true);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const userId = user?.id;
  function prepareAccount(
    controller: CloudProgress,
    store: Store,
    epoch: number,
  ) {
    if (!user) return;
    const candidate = signup.current.forUser(user);
    if (candidate && controller.canImportGuest) {
      setTransfer({ userId: user.id, store: candidate });
    } else if (controller.status !== "offline") {
      signup.current.clear();
      setTransfer(null);
    }
    setBoot({ id: user.id, store, epoch });
  }
  async function chooseTransfer(accept: boolean) {
    const controller = sync.current;
    if (!transfer || !controller || transfer.userId !== userId) return;
    setBusy(true);
    setError("");
    try {
      if (accept) {
        if (!controller.canImportGuest) throw Error("Account changed");
        controller.update(transfer.store);
        await controller.flush();
        if (sync.current !== controller) return;
        setBoot((b) => ({
          id: transfer.userId,
          store: controller.store,
          epoch: (b?.epoch ?? 0) + 1,
        }));
      }
      signup.current.clear();
      setTransfer(null);
    } catch {
      setError(
        "Le transfert n’a pas abouti. Votre progression sans compte est conservée. Vous pouvez réessayer.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    clearTimeout(timer.current);
    if (!userId || !supabase) {
      sync.current = null;
      setBoot(null);
      setTransfer(null);
      return;
    }
    let active = true;
    const controller = new CloudProgress(
      accountKey(userId),
      progressRepository(supabase, userId),
      () => {
        if (active) repaint((n) => n + 1);
      },
    );
    sync.current = controller;
    controller
      .open()
      .then((store) => {
        if (active) prepareAccount(controller, store, 0);
      })
      .catch(() => {
        if (active)
          setError(
            "Le stockage est inaccessible. Libérez de l’espace avant de charger votre compte.",
          );
      });
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, [userId]);
  const update = useCallback((store: Store) => {
    const controller = sync.current;
    if (!controller) return;
    controller.update(store);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void controller.flush();
    }, 400);
  }, []);
  async function reload(preferCloud: boolean) {
    const controller = sync.current;
    if (!controller || !userId) return;
    setBusy(true);
    setError("");
    try {
      // Preserve any unsent work before an explicit replacement.
      if (preferCloud)
        localStorage.setItem(
          `${controller.key}-recovery`,
          JSON.stringify(controller.store),
        );
      clearTimeout(timer.current);
      await controller.flush();
      const store = await controller.open(preferCloud);
      if (sync.current !== controller) return;
      prepareAccount(controller, store, (boot?.epoch ?? 0) + 1);
    } catch {
      setError(
        "Impossible de charger le parcours. Votre copie locale est conservée.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function emailAction(action: () => Promise<string>) {
    if (!supabase) return "";
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        {
          invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
          email_not_confirmed:
            "Confirmez votre adresse e-mail avant de vous connecter.",
          user_already_exists:
            "Un compte existe déjà avec cette adresse e-mail.",
          weak_password:
            "Choisissez un mot de passe plus long et plus difficile à deviner.",
          over_email_send_rate_limit:
            "Trop de demandes. Patientez avant de réessayer.",
          over_request_rate_limit:
            "Trop de demandes. Patientez avant de réessayer.",
        }[code || ""] ||
          "La demande n’a pas abouti. Vérifiez vos informations et réessayez.",
      );
      return "";
    } finally {
      setBusy(false);
    }
  }
  const account = {
    user,
    configured: !!supabase,
    status: sync.current?.status ?? ("saved" as const),
    error,
    busy,
    recovering,
    clearError: () => setError(""),
    signInWithEmail: (email: string, password: string) =>
      emailAction(async () => {
        signup.current.clear();
        const { error } = await supabase!.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return "Connexion réussie.";
      }),
    signUpWithEmail: (email: string, password: string) =>
      emailAction(async () => {
        signup.current.begin("email", email);
        const { data, error } = await supabase!.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) {
          signup.current.clear();
          throw error;
        }
        if (data.user) signup.current.forUser(data.user);
        else signup.current.clear();
        return data.session
          ? "Compte créé."
          : "Consultez votre boîte e-mail pour confirmer votre compte.";
      }),
    resetPassword: (email: string) =>
      emailAction(async () => {
        signup.current.clear();
        const { error } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
        return "Si un compte correspond à cette adresse, vous recevrez un e-mail pour réinitialiser votre mot de passe.";
      }),
    updatePassword: (password: string) =>
      emailAction(async () => {
        const { error } = await supabase!.auth.updateUser({ password });
        if (error) throw error;
        rememberRecovery(null);
        setRecovering(false);
        return "Votre mot de passe a été mis à jour.";
      }),
    async signIn() {
      if (!supabase) return;
      setBusy(true);
      setError("");
      try {
        signup.current.begin("google");
        if (!(await googleIsEnabled())) throw Error("Google disabled");
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: authRedirectUrl(),
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) throw error;
      } catch {
        signup.current.clear();
        setError(
          "La connexion Google n’est pas disponible pour le moment. Vous pouvez utiliser votre adresse e-mail.",
        );
      } finally {
        setBusy(false);
      }
    },
    async signOut() {
      if (!supabase) return;
      setBusy(true);
      setError("");
      try {
        clearTimeout(timer.current);
        await sync.current?.flush();
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      } catch {
        setError("La déconnexion a échoué. Réessayez.");
      } finally {
        setBusy(false);
      }
    },
    retry: () => reload(false),
    useCloud: () => reload(true),
  };
  return (
    <AccountContext.Provider value={account}>
      {!authReady || (userId && boot?.id !== userId) ? (
        <main className="account-loading" role="status">
          <strong>élan.</strong>
          <p>{error || "Votre parcours se prépare…"}</p>
          {error && userId && (
            <div className="account-loading-actions">
              <button
                className="button-primary"
                disabled={busy}
                onClick={() => void reload(false)}
              >
                Réessayer le chargement
              </button>
              <button
                className="button-quiet"
                disabled={busy}
                onClick={() => void account.signOut()}
              >
                Se déconnecter
              </button>
            </div>
          )}
        </main>
      ) : transfer && transfer.userId === userId && !recovering ? (
        <main className="account-loading">
          <Modal
            title="Garder votre progression ?"
            onClose={() => {
              if (!busy) void chooseTransfer(false);
            }}
          >
            <div className="account-panel signup-transfer">
              <p>
                Vous avez déjà joué sans compte. Voulez-vous retrouver cette
                progression sur votre nouveau compte ?
              </p>
              <p>
                Votre progression dans les deux jeux et votre partie en cours
                seront conservées.
              </p>
              {error && (
                <p className="account-notice" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button-primary"
                disabled={busy}
                onClick={() => void chooseTransfer(true)}
              >
                {busy ? "Veuillez patienter…" : "Oui, garder ma progression"}
              </button>
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() => void chooseTransfer(false)}
              >
                Commencer un nouveau parcours
              </button>
            </div>
          </Modal>
        </main>
      ) : (
        <App
          key={userId ? `${userId}-${boot!.epoch}` : "guest"}
          storageKey={userId ? accountKey(userId) : GUEST_STORAGE_KEY}
          initialStore={userId ? boot!.store : undefined}
          onStoreChange={userId ? update : undefined}
        />
      )}
    </AccountContext.Provider>
  );
}
