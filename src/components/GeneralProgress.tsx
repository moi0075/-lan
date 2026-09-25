import {
  ArrowRight,
  BookOpen,
  Flame,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  allGames,
  learningForGame,
  learningThemes,
  type LearningGame,
} from "../catalog/learningCatalog";
import { activityStreak, dateKey } from "../engine/learning";
import {
  summarizeProgress,
  type ProgressSummary,
} from "../engine/progressSummary";
import type { Profile } from "../engine/storage";
import { Stat } from "./LearningUI";
import { ProgressBar, Stats } from "./LearningLibrary";

interface Props {
  profile: Profile;
  summary: ProgressSummary;
  onGameProgress: (game: LearningGame) => void;
  onPlay: (game: LearningGame) => void;
}

export default function GeneralProgress({
  profile,
  summary,
  onGameProgress,
  onPlay,
}: Props) {
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return {
      date,
      key: dateKey(date.getTime()),
      value: summary.daily[dateKey(date.getTime())]?.attempts || 0,
    };
  });
  const weekMax = Math.max(10, ...week.map((day) => day.value));

  return (
    <div className="general-progress">
      <header className="library-heading general-heading">
        <div>
          <span className="eyebrow">
            <span /> VOTRE PARCOURS
          </span>
          <h1>Ma progression</h1>
          <p>
            {profile.name}, retrouvez ici vos acquis et votre activité dans tous
            les thèmes.
          </p>
        </div>
        <span className="library-heading-icon" aria-hidden="true">
          <TrendingUp size={31} />
        </span>
      </header>

      <section
        className="general-progress-hero"
        aria-label="Progression de tous les jeux"
      >
        <div className="general-hero-copy">
          <span className="eyebrow">
            <span /> VUE D’ENSEMBLE
          </span>
          <h2>Chaque savoir compte.</h2>
          <p>
            Vos acquis de chaque jeu composent votre progression générale. Un
            pays placé et un pays nommé sont deux compétences distinctes.
          </p>
        </div>
        <div className="general-hero-meter">
          <strong>
            {summary.mastered} <span>/ {summary.total}</span>
          </strong>
          <span>connaissances acquises dans {allGames.length} jeux</span>
          <ProgressBar
            summary={summary}
            label="Progression générale de tous les jeux"
          />
        </div>
      </section>

      <div className="stat-grid four general-stat-grid">
        <Stat
          icon={<Trophy size={21} />}
          value={summary.mastered}
          suffix={`/ ${summary.total}`}
          label="Connaissances acquises"
          detail="Tous les jeux réunis"
          color="purple"
        />
        <Stat
          icon={<Target size={21} />}
          value={summary.accuracy === null ? "—" : `${summary.accuracy} %`}
          label="Précision générale"
          detail={`${summary.correct} bonnes réponses`}
          color="peach"
        />
        <Stat
          icon={<BookOpen size={21} />}
          value={summary.attempts}
          label="Réponses données"
          detail={`${summary.learning} connaissances à consolider`}
          color="blue"
        />
        <Stat
          icon={<Flame size={21} />}
          value={activityStreak(summary.daily)}
          label="Jours de suite"
          detail={`${summary.daily[dateKey()]?.attempts || 0} réponses aujourd’hui`}
          color="peach"
        />
      </div>

      <div className="progress-panels general-progress-panels">
        <section className="white-panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TOUS LES JEUX</span>
              <h2>Vos 7 derniers jours</h2>
            </div>
            <span className="soft-chip">
              {week.reduce((sum, day) => sum + day.value, 0)} réponses
            </span>
          </div>
          <div className="activity-chart">
            {week.map((day) => (
              <div className="chart-column" key={day.key}>
                <span>{day.value}</span>
                <div className="bar-track">
                  <i
                    style={{
                      height: `${Math.max(2, (day.value / weekMax) * 100)}%`,
                    }}
                    className={day.key === dateKey() ? "today" : ""}
                  />
                </div>
                <small>
                  {day.date.toLocaleDateString("fr", { weekday: "short" })}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="white-panel general-more-stats">
          <span className="icon-tile purple">
            <TrendingUp size={22} />
          </span>
          <h2>Un suivi qui vous ressemble.</h2>
          <p>
            Vos difficultés reviennent plus souvent, tandis que vos acquis
            restent dans les révisions. Consultez chaque jeu pour voir les
            connaissances à travailler.
          </p>
          <details className="library-details">
            <summary>
              Voir toutes les statistiques <span aria-hidden="true">⌄</span>
            </summary>
            <Stats summary={summary} />
          </details>
        </section>
      </div>

      <section className="general-games" aria-label="Progression par jeu">
        <div className="library-section-title">
          <h2>Mes jeux</h2>
          <span>{allGames.length} jeux</span>
        </div>
        {learningThemes.map((theme) =>
          theme.topics.map((topic) => (
            <div className="general-topic" key={`${theme.id}-${topic.id}`}>
              <div className="general-topic-heading">
                <span>{theme.title}</span>
                <h3>{topic.title}</h3>
              </div>
              <div className="general-game-grid">
                {topic.games.map((game) => {
                  const gameSummary = summarizeProgress([
                    {
                      items: game.items,
                      learning: learningForGame(profile, game),
                    },
                  ]);
                  return (
                    <article
                      className="general-game-card"
                      key={game.id}
                      aria-label={`Progression · ${game.title}`}
                    >
                      <div className="general-game-heading">
                        <span className={`general-game-icon game-${game.mode}`}>
                          {game.mode === "place" ? (
                            <Target size={21} />
                          ) : (
                            <BookOpen size={21} />
                          )}
                        </span>
                        <div>
                          <span>{game.skill}</span>
                          <h4>{game.title}</h4>
                        </div>
                      </div>
                      <ProgressBar
                        summary={gameSummary}
                        label={`Progression · ${game.title}`}
                      />
                      <p>
                        {gameSummary.mastered} / {gameSummary.total} acquis ·{" "}
                        {gameSummary.attempts} réponses
                      </p>
                      <div className="general-game-actions">
                        <button
                          className="button-primary"
                          onClick={() => onGameProgress(game)}
                          aria-label={`Voir le détail · ${game.title}`}
                        >
                          Voir le détail <ArrowRight size={15} />
                        </button>
                        <button
                          className="text-link"
                          onClick={() => onPlay(game)}
                        >
                          {gameSummary.attempts ? "Reprendre" : "Commencer"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )),
        )}
      </section>
    </div>
  );
}
