import { allGames, type LearningGame } from "../catalog/learningCatalog";
import worldShapes from "../data/map.json";
import type { ProgressSummary } from "../engine/progressSummary";
import type { AppRoute } from "../useAppNavigation";
import BrandMark from "./BrandMark";
import "./paysage-home.css";

const placeGame = allGames.find((game) => game.mode === "place")!;
const nameGame = allGames.find((game) => game.mode === "name")!;
const themeRoute: AppRoute = { page: "library", themeId: "geography" };
const worldRoute: AppRoute = {
  page: "library",
  themeId: "geography",
  topicId: "world",
};

interface Props {
  summary: ProgressSummary;
  hasAccount: boolean;
  onBrowse: (route: AppRoute) => void;
  onPlay: (game: LearningGame) => void;
  onOpenAtlas: () => void;
  onProgress: () => void;
  onLeaderboard: () => void;
  onAccount: () => void;
}

function WorldGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`home-world ${className}`}
      viewBox="0 0 1000 510"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {worldShapes.map((shape, index) => (
        <path key={index} d={shape.d || ""} />
      ))}
    </svg>
  );
}

function LearningLandscape() {
  const arches = [
    { x: 105, width: 320, top: 255, fill: "#94a9bb" },
    { x: 390, width: 265, top: 315, fill: "#a4b9c9" },
    { x: 720, width: 460, top: 70, fill: "#8fa4b9" },
    { x: 1045, width: 260, top: 315, fill: "#a4b9c9" },
    { x: 1350, width: 330, top: 255, fill: "#94a9bb" },
  ];
  const archPath = (x: number, width: number, top: number) => {
    const left = x - width / 2;
    const right = x + width / 2;
    return `M ${left} 650 V ${top + width / 2} C ${left} ${top + width / 4}, ${x - width / 4} ${top}, ${x} ${top} C ${x + width / 4} ${top}, ${right} ${top + width / 4}, ${right} ${top + width / 2} V 650 Z`;
  };
  const wavePath = (y: number, rise: number) => {
    let path = `M 0 ${y}`;
    for (let x = 0; x < 1440; x += 180) {
      path += ` Q ${x + 90} ${y - rise} ${x + 180} ${y}`;
    }
    return `${path} V 650 H 0 Z`;
  };

  return (
    <svg
      className="paysage-landscape"
      viewBox="0 0 1440 650"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paysage-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cce7f6" stopOpacity="0" />
          <stop offset="100%" stopColor="#e9f5f8" stopOpacity=".8" />
        </linearGradient>
      </defs>
      <path
        d="M0 350 Q200 290 390 355 T780 340 T1200 350 T1440 320 V650 H0Z"
        fill="url(#paysage-mist)"
      />
      {arches.map((arch, index) => (
        <g key={index}>
          <path
            d={archPath(arch.x, arch.width, arch.top)}
            fill={arch.fill}
            stroke="#f7fbfc"
            strokeWidth="13"
          />
          <path
            d={archPath(arch.x, arch.width - 52, arch.top + 38)}
            fill="#d4dce5"
            stroke="#f7fbfc"
            strokeWidth="11"
          />
          <path
            d={archPath(arch.x, arch.width - 108, arch.top + 91)}
            fill="#b6c7d4"
            stroke="#f7fbfc"
            strokeWidth="10"
          />
          <path
            d={archPath(arch.x, Math.max(54, arch.width - 170), arch.top + 143)}
            fill="#e3e8ec"
            stroke="#f7fbfc"
            strokeWidth="9"
          />
        </g>
      ))}
      <path
        d="M 646 390 H 683 V 352 H 720 V 314 H 757 V 276 H 794"
        fill="none"
        stroke="#486985"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="794" cy="276" r="15" fill="#fff0a0" />
      <path
        d={wavePath(502, 95)}
        fill="#c3d9e8"
        stroke="#f7fbfc"
        strokeWidth="11"
      />
      <path
        d={wavePath(555, 72)}
        fill="#86b5d1"
        stroke="#f7fbfc"
        strokeWidth="11"
      />
      <path
        d={wavePath(603, 62)}
        fill="#b8d6e8"
        stroke="#f7fbfc"
        strokeWidth="11"
      />
      <path
        d={wavePath(643, 53)}
        fill="#d5e9f2"
        stroke="#f7fbfc"
        strokeWidth="10"
      />
      <circle cx="170" cy="190" r="4" fill="#fff4b0" />
      <circle cx="1170" cy="215" r="4" fill="#fff4b0" />
      <path
        d="M 250 135 v 20 m -10 -10 h 20 M 1110 102 v 19 m -9.5 -9.5 h 19"
        stroke="#fff4b0"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeHeader({
  onBrowse,
  onProgress,
  onLeaderboard,
  onAccount,
  hasAccount,
}: Pick<
  Props,
  "onBrowse" | "onProgress" | "onLeaderboard" | "onAccount" | "hasAccount"
>) {
  return (
    <header className="home-site-header">
      <button
        className="home-site-brand"
        aria-label="Élan, accueil"
        onClick={() => onBrowse({ page: "library" })}
      >
        <BrandMark size={29} />
        <span className="home-site-brand-copy">
          élan
          <small>Le savoir en mouvement</small>
        </span>
      </button>
      <nav aria-label="Navigation de l’accueil">
        <button onClick={onProgress}>Ma progression</button>
        <button onClick={onLeaderboard}>Classement</button>
        <button onClick={onAccount}>
          {hasAccount ? "Mon compte" : "Se connecter"}
        </button>
      </nav>
    </header>
  );
}

function Knowledge({ summary }: { summary: ProgressSummary }) {
  return (
    <div className="home-knowledge">
      <strong>
        {summary.mastered} / {summary.total}
      </strong>
      <span>connaissances acquises</span>
      <progress
        value={summary.mastered}
        max={summary.total || 1}
        aria-label="Maîtrise de l’ensemble des jeux"
      />
    </div>
  );
}

export default function PaysageHome(props: Props) {
  const header = (
    <HomeHeader
      onBrowse={props.onBrowse}
      onProgress={props.onProgress}
      onLeaderboard={props.onLeaderboard}
      onAccount={props.onAccount}
      hasAccount={props.hasAccount}
    />
  );
  return (
    <div className="home-paysage">
      <div className="paysage-page">
        {header}
        <section className="paysage-hero" aria-labelledby="paysage-title">
          <h1 id="paysage-title">APPRENDRE</h1>
          <p className="paysage-hero-line">Chaque idée ouvre un chemin.</p>
          <LearningLandscape />
          <button
            className="paysage-disc paysage-disc-theme"
            onClick={() => props.onBrowse(themeRoute)}
          >
            Découvrir la géographie
          </button>
          <button
            className="paysage-disc paysage-disc-progress"
            onClick={props.onProgress}
          >
            Voir mes acquis
          </button>
          <span className="paysage-hero-caption">
            Élan · Le savoir en mouvement
          </span>
        </section>
        <section
          className="paysage-theme"
          aria-label="Premier thème disponible"
        >
          <div className="paysage-theme-intro">
            <span>Premier thème disponible</span>
            <h2>La géographie, pour commencer.</h2>
            <p>
              Regardez le monde, retrouvez les pays, puis voyez ce qui reste en
              mémoire.
            </p>
            <button onClick={() => props.onBrowse(worldRoute)}>
              Explorer le thème
            </button>
          </div>
          <div className="paysage-theme-map" aria-hidden="true">
            <WorldGraphic />
          </div>
        </section>
        <section className="paysage-activities" aria-label="Jeux de géographie">
          <button onClick={() => props.onPlay(placeGame)}>
            <span>Sur la carte</span>
            <strong>Placer les pays</strong>
            <small>Un nom apparaît, trouvez sa place.</small>
          </button>
          <button onClick={() => props.onPlay(nameGame)}>
            <span>De mémoire</span>
            <strong>Nommer les pays</strong>
            <small>Un pays apparaît, retrouvez son nom.</small>
          </button>
          <button onClick={props.onOpenAtlas}>
            <span>À votre rythme</span>
            <strong>Explorer la carte</strong>
            <small>Parcourez les 197 pays.</small>
          </button>
        </section>
        <div className="paysage-progress">
          <Knowledge summary={props.summary} />
        </div>
      </div>
    </div>
  );
}
