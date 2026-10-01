import { Check, Pencil } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  publicIdentity,
  publicNameError,
  type PublicPlayer,
} from "../leaderboard/api";
import { useAccount } from "./AccountContext";

/** One account alias editor, shared by the account panel and settings. */
export default function PseudoEditor({
  onSaved,
}: {
  onSaved: (name: string) => void;
}) {
  const account = useAccount();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const dirty = useRef(false);
  const userId = account.user?.id;
  const cloudSaved = account.status === "saved";

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    publicIdentity(
      AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    )
      .then((identity) => {
        if (controller.signal.aborted) return;
        setPlayer(identity);
        if (!dirty.current) setName(identity?.display_name ?? "");
        if (!identity)
          setError(
            "Votre pseudo sera disponible après la sauvegarde de votre compte.",
          );
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Impossible de charger votre pseudo. Réessayez.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [userId, cloudSaved, retry]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const invalid = publicNameError(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const identity = await publicIdentity(AbortSignal.timeout(12000), name);
      if (!identity) throw Error("Compte indisponible");
      setPlayer(identity);
      setName(identity.display_name);
      dirty.current = false;
      onSaved(identity.display_name);
      setMessage("Votre pseudo a été mis à jour.");
    } catch {
      setError("Votre pseudo n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-pseudo">
      <h3>
        <Pencil size={17} /> Votre pseudo
      </h3>
      <p>Ce nom apparaît dans votre parcours et dans le classement public.</p>
      <form className="account-form" onSubmit={save}>
        <label htmlFor="account-pseudo">Pseudo</label>
        <input
          id="account-pseudo"
          aria-describedby="account-pseudo-help"
          autoComplete="nickname"
          minLength={2}
          maxLength={32}
          required
          value={name}
          disabled={loading || saving || !player || account.busy}
          onChange={(event) => {
            dirty.current = true;
            setName(event.target.value);
            setError("");
            setMessage("");
          }}
        />
        <small id="account-pseudo-help">
          2 à 32 caractères, sans adresse e-mail.
        </small>
        <button
          className="button-primary"
          disabled={
            loading ||
            saving ||
            !player ||
            account.busy ||
            name.trim() === player?.display_name
          }
        >
          <Check size={16} />{" "}
          {saving ? "Enregistrement…" : "Enregistrer mon pseudo"}
        </button>
      </form>
      {loading && <p role="status">Chargement du pseudo…</p>}
      {error && (
        <p className="account-notice" role="alert">
          {error}
          {!player && (
            <button
              className="button-quiet"
              onClick={() => setRetry((value) => value + 1)}
              disabled={loading}
            >
              Réessayer le chargement du pseudo
            </button>
          )}
        </p>
      )}
      {message && (
        <p className="account-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
