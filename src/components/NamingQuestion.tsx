import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, MapPin, Sparkles } from "lucide-react";
import { CountryFlag, MiniProgress } from "./LearningUI";
import type { Country } from "../data/catalog";
import type { Answer } from "../engine/storage";

interface Props {
  country: Country;
  question: number;
  feedback: Answer | null;
  streak: number;
  onAnswer: (name: string) => void;
  onSkip: () => void;
  onNext: () => void;
}

export default function NamingQuestion({
  country,
  question,
  feedback,
  streak,
  onAnswer,
  onSkip,
  onNext,
}: Props) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const submittedWithKeyboard = useRef(false);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (feedback && submittedWithKeyboard.current)
      nextButton.current?.focus({ preventScroll: true });
  }, [feedback]);
  return (
    <section
      className={`focus-question naming-question ${feedback ? "is-answered" : ""}`}
      aria-label="Question en cours"
    >
      <div className="focus-question-heading">
        <div className="focus-country">
          {feedback ? (
            <CountryFlag country={country} large />
          ) : (
            <span className="naming-symbol" aria-hidden="true">
              <MapPin size={28} />
            </span>
          )}
          <div>
            <span className="focus-prompt-label">NOMMER LES PAYS</span>
            <h2>{feedback ? country.name : "Quel est ce pays ?"}</h2>
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
            className={`focus-result ${feedback.nameMatch === "close" ? "is-close" : feedback.correct ? "is-correct" : "is-incorrect"}`}
          >
            {feedback.correct ? <Check size={17} /> : <MapPin size={17} />}
            <b>
              {feedback.nameMatch === "close"
                ? "Presque ! Le nom est à corriger."
                : feedback.correct
                  ? "Exactement, bien joué !"
                  : "Un nouveau nom à retenir."}
            </b>
          </div>
          <p>
            {feedback.nameMatch === "close" ? (
              <>
                Vous avez écrit « {feedback.typedName} ». On écrit{" "}
                <strong>{country.name}</strong>. Cette réponse compte comme une
                erreur proche : elle reviendra moins vite qu’un pays non
                reconnu.
              </>
            ) : feedback.correct ? (
              `${country.capital} · ${country.continent}`
            ) : (
              <>
                {feedback.typedName ? (
                  <>Votre réponse : « {feedback.typedName} ». </>
                ) : null}
                Le pays surligné est <strong>{country.name}</strong>. Il
                reviendra pour vous aider à le retenir.
              </>
            )}
          </p>
          <div className="focus-feedback-actions">
            <span className="focus-memory">
              {feedback.unlocked ? (
                <>
                  <Sparkles size={14} />
                  {feedback.unlocked} nouveaux pays débloqués !
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
              ref={nextButton}
              className="button-primary"
              data-next-question=""
              aria-keyshortcuts="Space"
              onClick={onNext}
            >
              Pays suivant <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <form
          className="naming-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onAnswer(value.trim());
          }}
        >
          <label htmlFor="country-name">
            Nommez le pays surligné en violet.
          </label>
          <div className="naming-input-row">
            <input
              ref={input}
              id="country-name"
              name="country-name"
              aria-describedby="name-tolerance"
              placeholder="Écrivez le nom du pays…"
              value={value}
              maxLength={100}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.nativeEvent.isComposing) e.preventDefault();
                  else submittedWithKeyboard.current = true;
                }
              }}
            />
            <button
              type="submit"
              className="button-primary"
              disabled={!value.trim()}
              onPointerDown={() => {
                submittedWithKeyboard.current = false;
              }}
            >
              Valider <ArrowRight size={16} />
            </button>
          </div>
          <div className="naming-form-footer">
            <p id="name-tolerance">
              Une petite faute reste une erreur, avec une révision adaptée.
            </p>
            <button type="button" className="focus-skip" onClick={onSkip}>
              Je ne sais pas encore <ArrowRight size={14} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
