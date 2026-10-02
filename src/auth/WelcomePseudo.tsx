import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { publicIdentity } from "../leaderboard/api";
import { useAccount } from "./AccountContext";
import PseudoEditor from "./PseudoEditor";
import { supabase } from "./supabase";

// Only accounts created since this welcome step was introduced need it.
const INTRODUCED_AT = Date.parse("2026-10-02T00:00:00Z");
export default function WelcomePseudo({
  enabled,
  onSaved,
}: {
  enabled: boolean;
  onSaved: (name: string) => void;
}) {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const user = account.user;
  const key = user ? `elan-pseudo-welcome-${user.id}` : "";

  useEffect(() => {
    if (
      !enabled ||
      !user ||
      account.recovering ||
      account.status !== "saved" ||
      dismissed ||
      user.user_metadata.pseudo_welcome_completed ||
      Date.parse(user.created_at) < INTRODUCED_AT
    )
      return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* The account metadata also remembers this choice. */
    }
    const controller = new AbortController();
    publicIdentity(
      AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    )
      .then((player) => {
        if (
          !controller.signal.aborted &&
          /^Joueur [a-f0-9]{5,6}$/i.test(player?.display_name ?? "")
        )
          setOpen(true);
      })
      .catch(() => {
        /* The account editor remains available if offline. */
      });
    return () => controller.abort();
  }, [enabled, user, account.recovering, account.status, dismissed, key]);

  function finish() {
    setOpen(false);
    setDismissed(true);
    try {
      localStorage.setItem(key, "done");
    } catch {
      /* Optional local fallback. */
    }
    // This preference is presentation only, never an authorization claim.
    void supabase?.auth
      .updateUser({ data: { pseudo_welcome_completed: true } })
      .catch(() => {});
  }

  if (!open || !enabled || account.recovering) return null;
  return (
    <Modal title="Choisissez votre pseudo" onClose={finish}>
      <div className="account-panel">
        <p>
          Bienvenue sur élan ! Personnalisez le nom qui apparaîtra dans votre
          parcours et dans le classement.
        </p>
        <PseudoEditor
          onSaved={(name) => {
            onSaved(name);
            finish();
          }}
        />
        <button className="button-quiet" onClick={finish}>
          Plus tard
        </button>
        <small>
          Vous pourrez le changer à tout moment dans « Mon compte ».
        </small>
      </div>
    </Modal>
  );
}
