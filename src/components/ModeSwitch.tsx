import { MapPin, Keyboard } from "lucide-react";
import type { GameMode } from "../engine/storage";

export default function ModeSwitch({
  mode,
  onChange,
}: {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}) {
  return (
    <div className="mode-switch" role="group" aria-label="Variante du jeu">
      <button
        type="button"
        aria-pressed={mode === "place"}
        onClick={() => onChange("place")}
      >
        <MapPin size={13} /> Placer
      </button>
      <button
        type="button"
        aria-pressed={mode === "name"}
        onClick={() => onChange("name")}
      >
        <Keyboard size={13} /> Nommer
      </button>
    </div>
  );
}
