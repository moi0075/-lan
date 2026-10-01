import { Cloud, CloudOff, LogOut } from "lucide-react";
import { useState } from "react";
import { useAccount } from "./AccountContext";
import PseudoEditor from "./PseudoEditor";

export type FormMode = "login" | "signup" | "reset";
export default function AccountPanel({
  onModeChange,
  onNameChange,
}: {
  onModeChange: (mode: FormMode) => void;
  onNameChange: (name: string) => void;
}) {
  const account = useAccount();
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const disabled = !account.configured || account.busy;
  const changeMode = (next: FormMode) => {
    setMode(next);
    onModeChange(next);
    account.clearError();
    setPassword("");
    setMessage("");
  };
  return (
    <div className="account-panel">
      {account.error && (
        <p className="account-notice" role="alert">
          {account.error}
        </p>
      )}
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
      {account.recovering ? (
        <form
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await account.updatePassword(password);
            if (result) {
              setPassword("");
              setMessage(result);
            }
          }}
        >
          <p>Choisissez votre nouveau mot de passe.</p>
          <label htmlFor="account-new-password">Nouveau mot de passe</label>
          <input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disabled}
          />
          <button className="button-primary" disabled={disabled}>
            Enregistrer le mot de passe
          </button>
        </form>
      ) : account.user ? (
        <>
          <div className="account-sync" role="status">
            {account.status === "saved" ? (
              <Cloud size={20} />
            ) : (
              <CloudOff size={20} />
            )}
            <span>
              {
                {
                  loading: "Chargement…",
                  saving: "Sauvegarde en cours…",
                  saved: "Parcours sauvegardé sur votre compte",
                  offline:
                    "Sauvegarde en ligne indisponible. Vos progrès restent sur cet appareil.",
                  conflict: "Votre progression a changé sur un autre appareil.",
                }[account.status]
              }
            </span>
          </div>
          {account.status === "offline" && (
            <button
              className="button-secondary"
              disabled={account.busy}
              onClick={() => void account.retry()}
            >
              Réessayer la sauvegarde
            </button>
          )}
          {account.status === "conflict" && (
            <button
              className="button-secondary"
              disabled={account.busy}
              onClick={() => void account.useCloud()}
            >
              Actualiser la progression
            </button>
          )}
          <PseudoEditor onSaved={onNameChange} />
          <button
            className="button-quiet"
            disabled={account.busy}
            onClick={() => void account.signOut()}
          >
            <LogOut size={17} /> Se déconnecter
          </button>
        </>
      ) : (
        <>
          {mode !== "reset" && (
            <>
              <button
                className="google-sign-in"
                disabled={disabled}
                onClick={() => void account.signIn()}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3a10 10 0 0 0 0 8.8l3.4-2.6Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.6l3.4 2.6A6 6 0 0 1 12 6Z"
                  />
                </svg>
                Continuer avec Google
              </button>
              <div className="account-separator">
                <span>ou avec une adresse e-mail</span>
              </div>
            </>
          )}
          <form
            className="account-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage("");
              const address = email.trim();
              const result =
                mode === "reset"
                  ? await account.resetPassword(address)
                  : mode === "signup"
                    ? await account.signUpWithEmail(address, password)
                    : await account.signInWithEmail(address, password);
              if (result) {
                setPassword("");
                setMessage(result);
              }
            }}
          >
            {mode === "reset" && (
              <p>Recevez un lien pour choisir un nouveau mot de passe.</p>
            )}
            <label htmlFor="account-email">Adresse e-mail</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
            />
            {mode !== "reset" && (
              <>
                <label htmlFor="account-password">Mot de passe</label>
                <input
                  id="account-password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={disabled}
                />
                {mode === "signup" && <small>8 caractères minimum.</small>}
              </>
            )}
            <button className="button-primary" disabled={disabled}>
              {account.busy
                ? "Veuillez patienter…"
                : mode === "reset"
                  ? "Envoyer le lien"
                  : mode === "signup"
                    ? "Créer mon compte"
                    : "Se connecter"}
            </button>
          </form>
          <div className="account-form-links">
            {mode === "login" ? (
              <>
                <button
                  className="button-quiet"
                  disabled={account.busy}
                  onClick={() => changeMode("reset")}
                >
                  Mot de passe oublié ?
                </button>
                <button
                  className="button-quiet"
                  disabled={account.busy}
                  onClick={() => changeMode("signup")}
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <button
                className="button-quiet"
                disabled={account.busy}
                onClick={() => changeMode("login")}
              >
                Retour à la connexion
              </button>
            )}
          </div>
          {!account.configured && (
            <p role="status">
              La connexion n’est pas encore disponible sur ce site.
            </p>
          )}
        </>
      )}
    </div>
  );
}
