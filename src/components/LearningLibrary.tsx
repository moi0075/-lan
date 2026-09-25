import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Globe2,
  Keyboard,
  Layers3,
  MapPin,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  allGames,
  learningForGame,
  learningThemes,
  type LearningGame,
} from "../catalog/learningCatalog";
import { activityStreak } from "../engine/learning";
import {
  summarizeProgress,
  type ProgressSummary,
} from "../engine/progressSummary";
import type { Profile } from "../engine/storage";
import type { AppRoute } from "../useAppNavigation";
import worldShapes from "../data/map.json";
import BrandMark from "./BrandMark";

const number = new Intl.NumberFormat("fr", { maximumFractionDigits: 1 });

export function ProgressBar({
  summary,
  label,
}: {
  summary: ProgressSummary;
  label: string;
}) {
  return (
    <div className="library-progress">
      <div>
        <span>{label}</span>
        <b>{number.format(summary.percent)} %</b>
      </div>
      <progress
        max={summary.total || 1}
        value={summary.mastered}
        aria-label={label}
      />
    </div>
  );
}

export function Stats({
  summary,
  game = false,
}: {
  summary: ProgressSummary;
  game?: boolean;
}) {
  const rows = [
    ["Réponses données", summary.attempts],
    ["Précision", summary.accuracy === null ? "—" : `${summary.accuracy} %`],
    ["À consolider", summary.learning],
    ["Jours de suite", activityStreak(summary.daily)],
    ["Points d’expérience", `${summary.xp} XP`],
    ...(game
      ? [
          ["Pays débloqués", `${summary.unlocked} / ${summary.total}`],
          ["Erreurs proches", summary.nearMisses],
        ]
      : []),
  ];
  return (
    <dl className="library-stats">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{typeof value === "number" ? number.format(value) : value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GamePreview({ mode }: { mode: LearningGame["mode"] }) {
  return (
    <div className={`game-preview preview-${mode}`} aria-hidden="true">
      <svg viewBox="0 0 1000 510" className="preview-world">
        {worldShapes.map((shape, index) => (
          <path key={index} d={shape.d || ""} />
        ))}
      </svg>
      <span className="preview-direction">
        {mode === "place" ? "UN NOM → UNE POSITION" : "UNE POSITION → UN NOM"}
      </span>
      <div className="preview-symbol">
        {mode === "place" ? (
          <MapPin size={36} strokeWidth={1.5} />
        ) : (
          <Keyboard size={36} strokeWidth={1.5} />
        )}
      </div>
      <span className="preview-caption">
        {mode === "place" ? "Où se trouve ce pays ?" : "Quel est son nom ?"}
      </span>
    </div>
  );
}

interface Props {
  profile: Profile;
  route: AppRoute;
  onBrowse: (route: AppRoute) => void;
  onPlay: (game: LearningGame) => void;
  onStats: (game: LearningGame) => void;
  onOpenAtlas: () => void;
}

export default function LearningLibrary({
  profile,
  route,
  onBrowse,
  onPlay,
  onStats,
  onOpenAtlas,
}: Props) {
  const theme = learningThemes.find((item) => item.id === route.themeId);
  const topic = theme?.topics.find((item) => item.id === route.topicId);
  const summarize = (games: readonly LearningGame[]) =>
    summarizeProgress(
      games.map((game) => ({
        items: game.items,
        learning: learningForGame(profile, game),
      })),
    );
  const overall = summarize(allGames);
  const collection = topic
    ? topic.games
    : theme?.topics.flatMap((item) => item.games);

  return (
    <div className="learning-library">
      <header
        className={`library-heading ${!theme ? "library-home-heading" : ""}`}
      >
        <div>
          <span className="eyebrow">
            <span />
            {topic
              ? "CHOISISSEZ VOTRE JEU"
              : theme
                ? "CHOISISSEZ UN SOUS-THÈME"
                : "VOTRE BIBLIOTHÈQUE"}
          </span>
          <h1>
            {topic?.title || theme?.title || (
              <>
                Apprendre, <em>à votre rythme.</em>
              </>
            )}
          </h1>
          <p>
            {topic?.description ||
              theme?.description ||
              `${profile.name}, choisissez un thème, pratiquez quelques minutes et voyez vos connaissances grandir.`}
          </p>
        </div>
        <span className="library-heading-icon" aria-hidden="true">
          {theme ? (
            (topic?.art || theme.art) === "globe" ? (
              <Globe2 size={32} />
            ) : (
              <BookOpen size={32} />
            )
          ) : (
            <BrandMark size={38} />
          )}
        </span>
      </header>

      <section className="library-overview" aria-label="Progression générale">
        <div className="overview-main">
          <div className="overview-copy">
            <span className="overview-icon">
              <TrendingUp size={21} />
            </span>
            <div>
              <h2>Votre progression générale</h2>
              <p>Tous vos jeux, un chemin qui se construit.</p>
            </div>
          </div>
          <div className="overview-progress">
            <ProgressBar
              summary={overall}
              label="Maîtrise de l’ensemble des jeux"
            />
            <p>
              <b>
                {overall.mastered} / {overall.total}
              </b>{" "}
              connaissances acquises · {allGames.length} jeux
            </p>
          </div>
        </div>
        <details className="library-details">
          <summary>
            <span>Voir les statistiques générales</span>
            <ChevronDown size={16} />
          </summary>
          <Stats summary={overall} />
          <p className="library-stat-note">
            Chaque connaissance est comptée dans son jeu : placer un pays et le
            nommer sont deux acquis distincts. Une erreur remet l’acquis
            concerné à consolider. La précision porte sur toutes vos réponses.
          </p>
        </details>
      </section>

      <div className="library-section-title">
        <h2>
          {topic
            ? topic.games.length === 2
              ? "Deux jeux, deux compétences"
              : "Les jeux à explorer"
            : theme
              ? "Les sous-thèmes"
              : "Les thèmes à explorer"}
        </h2>
        <span>
          {topic
            ? `${topic.games.length} jeux`
            : theme
              ? `${theme.topics.length} sous-thème${theme.topics.length > 1 ? "s" : ""}`
              : `${learningThemes.length} thème${learningThemes.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {theme?.id === "geography" && topic?.id === "world" && (
        <button className="library-topic-link" onClick={onOpenAtlas}>
          <Globe2 size={17} />
          Explorer les 197 pays sur la carte
          <ArrowRight size={16} />
        </button>
      )}

      {topic ? (
        <div className="library-game-grid">
          {topic.games.map((game) => {
            const summary = summarize([game]);
            return (
              <article
                className={`library-game-card game-${game.mode}`}
                key={game.id}
                aria-label={game.title}
              >
                <GamePreview mode={game.mode} />
                <div className="library-game-body">
                  <span className="game-skill">{game.skill}</span>
                  <h3>{game.title}</h3>
                  <p className="game-description">{game.description}</p>
                  <ProgressBar
                    summary={summary}
                    label={`Progression · ${game.title}`}
                  />
                  <div className="game-progress-caption">
                    <span>
                      <b>{summary.mastered}</b> / {summary.total} pays acquis
                    </span>
                    <span>
                      {summary.attempts ? "Parcours en cours" : "À découvrir"}
                    </span>
                  </div>
                  <button
                    className="button-primary library-play"
                    onClick={() => onPlay(game)}
                  >
                    {summary.attempts ? "Reprendre" : "Commencer"} ·{" "}
                    {game.mode === "place" ? "Placer" : "Nommer"}
                    <ArrowRight size={17} />
                  </button>
                  <details className="library-details game-details">
                    <summary>
                      <span>Statistiques du jeu</span>
                      <ChevronDown size={16} />
                    </summary>
                    <Stats summary={summary} game />
                    <button className="text-link" onClick={() => onStats(game)}>
                      Voir le suivi par pays <ArrowRight size={15} />
                    </button>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="library-collections">
          {(theme ? theme.topics : learningThemes).map((entry) => {
            const games =
              "games" in entry
                ? entry.games
                : entry.topics.flatMap((item) => item.games);
            const summary = summarize(games);
            return (
              <article className="library-collection-card" key={entry.id}>
                <div className="collection-art" aria-hidden="true">
                  <span className="collection-orbit" />
                  {entry.art === "globe" ? (
                    <Globe2 size={148} strokeWidth={0.65} />
                  ) : (
                    <BookOpen size={148} strokeWidth={0.65} />
                  )}
                  <span className="collection-art-caption">
                    {theme
                      ? `${new Set(games.flatMap((game) => game.items.map((item) => item.id))).size} CONNAISSANCES À DÉCOUVRIR`
                      : "OUVREZ VOS HORIZONS"}
                  </span>
                </div>
                <div className="collection-body">
                  <span className="collection-label">
                    <Layers3 size={14} />
                    {theme
                      ? `${games.length} jeux complémentaires`
                      : `${"topics" in entry ? entry.topics.length : 0} sous-thème · ${games.length} jeux`}
                  </span>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                  <ProgressBar
                    summary={summary}
                    label={`Progression · ${entry.title}`}
                  />
                  <span className="collection-acquired">
                    {summary.mastered} / {summary.total} connaissances acquises
                  </span>
                  <button
                    className="button-primary"
                    onClick={() =>
                      onBrowse({
                        page: "library",
                        themeId: theme?.id || entry.id,
                        topicId: theme ? entry.id : undefined,
                      })
                    }
                  >
                    {theme ? "Choisir un jeu" : "Explorer le thème"}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="library-learning-note">
        <Sparkles size={20} />
        <p>
          <b>Un parcours qui s’adapte à vous.</b> Vos erreurs reviennent plus
          souvent, vos acquis sont révisés et de nouvelles connaissances se
          débloquent à votre rythme.
        </p>
      </div>
      {collection && (
        <p className="collection-total">
          {summarize(collection).mastered} connaissances acquises pour «{" "}
          {topic?.title || theme?.title} ». Vos progrès sont enregistrés pour{" "}
          {profile.name}.
        </p>
      )}
    </div>
  );
}
