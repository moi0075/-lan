import { ArrowLeft, Expand, Minimize } from "lucide-react";

interface Props {
  fullscreen: boolean;
  onExit: () => void;
  onToggleFullscreen: () => void;
}

/** Render directly inside the fullscreen root, outside the map's hit-test layer. */
export default function FocusControls({
  fullscreen,
  onExit,
  onToggleFullscreen,
}: Props) {
  return (
    <>
      <button
        type="button"
        className="game-control focus-exit"
        onClick={onExit}
        aria-label="Quitter le mode jeu"
      >
        <ArrowLeft size={17} />
        <span>Quitter le mode jeu</span>
      </button>
      <button
        type="button"
        className="game-control focus-fullscreen"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? "Réduire le plein écran" : "Plein écran"}
        aria-pressed={fullscreen}
      >
        {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
        <span>{fullscreen ? "Réduire" : "Plein écran"}</span>
      </button>
    </>
  );
}
