import { ArrowRight, Check, Lightbulb, MapPin, Sparkles } from "lucide-react";
import { CountryFlag, MiniProgress } from "./LearningUI";
import { countryById, type Country } from "../data/catalog";
import type { Answer } from "../engine/storage";
import { focusAfterKeyboard } from "./focusAfterKeyboard";
import ModeSwitch from "./ModeSwitch";
import type { GameMode } from "../engine/storage";
interface Props {
  country: Country;
  question: number;
  reason: string;
  feedback: Answer | null;
  hinted: boolean;
  streak: number;
  onHint: () => void;
  onSkip: () => void;
  onNext: () => void;
  onMode: (mode: GameMode) => void;
}
/** Compact question overlay, independent from the map's zoom and pan state. */
export default function FocusQuestion({
  country,
  question,
  reason,
  feedback,
  hinted,
  streak,
  onHint,
  onSkip,
  onNext,
  onMode,
}: Props) {
  return (
    <section
      className={`focus-question ${feedback ? "is-answered" : ""}`}
      aria-label="Question en cours"
    >
      <div className="focus-question-heading">
        <div className="focus-country">
          <CountryFlag country={country} large />
          <div>
            <ModeSwitch mode="place" onChange={onMode} />
            <h2>
              {country.name}
              {!feedback && " ?"}
            </h2>
          </div>
        </div>
        <div className="focus-question-count">
          <span>QUESTION</span>
          <b>{String(question).padStart(2, "0")}</b>
        </div>
      </div>
      {feedback ? (
        <div className="focus-feedback" aria-live="polite">
          <div
            className={`focus-result ${feedback.correct ? "is-correct" : "is-incorrect"}`}
          >
            {feedback.correct ? <Check size={17} /> : <MapPin size={17} />}
            <b>
              {feedback.correct
                ? feedback.assisted
                  ? "Bien trouvé, avec un indice !"
                  : "Bien joué, c’est ici !"
                : "Un nouveau repère à retenir."}
            </b>
          </div>
          <p>
            {feedback.correct
              ? feedback.assisted
                ? "Essayez sans indice au prochain passage pour consolider ce pays."
                : `${country.capital} · ${country.continent}`
              : `${feedback.selectedId ? `Votre choix : ${countryById.get(feedback.selectedId)?.name || "un autre territoire"}.` : "Prenez le temps de mémoriser sa position."} ${country.name} est indiqué par le repère sur la carte.`}
          </p>
          <div className="focus-feedback-actions">
            <span className="focus-memory">
              {feedback.unlocked > 0 ? (
                <>
                  <Sparkles size={14} /> {feedback.unlocked} nouveaux pays
                  débloqués !
                </>
              ) : (
                <>
                  <span>
                    {streak >= 3 ? "Pays acquis" : "Vers la maîtrise"}
                  </span>
                  <MiniProgress value={streak} />
                </>
              )}
            </span>
            <button
              ref={focusAfterKeyboard}
              className="button-primary"
              data-next-question=""
              aria-keyshortcuts="Space"
              onClick={onNext}
            >
              Pays suivant
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="focus-question-actions">
          <span className="focus-reason">
            <span className="reason-dot" />
            {hinted ? <>5 zones possibles sur la carte</> : reason}
          </span>
          <div>
            {!hinted && (
              <button className="focus-hint" onClick={onHint}>
                <Lightbulb size={16} />
                Indice : 5 pays
              </button>
            )}
            <button className="focus-skip" onClick={onSkip}>
              Je ne sais pas encore
              <ArrowRight size={14} />
            </button>
          </div>
          {hinted && (
            <small className="focus-hint-note" role="status">
              Une seule zone est correcte. Cette réponse restera un entraînement
              guidé.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
