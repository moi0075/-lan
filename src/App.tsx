import { MiniProgress, CountryFlag, Stat } from "./components/LearningUI";
import { useEffect, useRef, useState } from "react";
import FocusQuestion from "./components/FocusQuestion";
import FocusControls from "./components/FocusControls";
import NamingQuestion from "./components/NamingQuestion";
import ModeSwitch from "./components/ModeSwitch";
import LearningLibrary from "./components/LearningLibrary";
import GeneralProgress from "./components/GeneralProgress";
import BrandMark from "./components/BrandMark";
import {
  allGames,
  learningForGame,
  learningThemes,
  type LearningGame,
} from "./catalog/learningCatalog";
import { summarizeProgress } from "./engine/progressSummary";
import { useAppNavigation, type Page } from "./useAppNavigation";
import { evaluateCountryName } from "./engine/nameAnswer";
import { focusAfterKeyboard } from "./components/focusAfterKeyboard";
import { candidateCountries } from "./engine/hints";
import {
  ArrowDownToLine,
  Expand,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Flame,
  Globe2,
  GraduationCap,
  Layers3,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Plus,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import WorldMap from "./components/WorldMap";
import Modal from "./components/Modal";
import { countries, countryById, flag, population } from "./data/catalog";
import source from "./data/source.json";
import {
  activityStreak,
  dateKey,
  isMastered,
  recordAttempt,
  statusOf,
} from "./engine/learning";
import {
  downloadStore,
  loadStore,
  makeProfile,
  parseStore,
  saveStore,
  startSession,
  recordSessionAnswer,
  nextSessionQuestion,
  progressFor,
  changeGameMode,
  type GameMode,
  type ProgressTrack,
  type Answer,
  type Profile,
  type Store,
} from "./engine/storage";

type Dialog = "help" | "profiles" | "settings" | null;
const reasons = {
  discovery: "Nouvelle découverte",
  practice: "On consolide",
  repair: "À retrouver",
  review: "Petite révision",
};
const statusLabels = {
  new: "À découvrir",
  learning: "En apprentissage",
  review: "À renforcer",
  mastered: "Acquis",
};
function App() {
  const initial = useRef<ReturnType<typeof loadStore> | null>(null);
  if (!initial.current) initial.current = loadStore();
  const [store, setStore] = useState<Store>(() => {
    const s = initial.current!.store;
    return {
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === s.activeId && !p.session
          ? { ...p, session: startSession(p) }
          : p,
      ),
    };
  });
  const [storageError, setStorageError] = useState(initial.current.error || "");
  const { route, go } = useAppNavigation();
  const page = route.page;
  const [focusMode, setFocusMode] = useState(true);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [profileName, setProfileName] = useState("");
  const [rename, setRename] = useState("");
  const [query, setQuery] = useState("");
  const [continent, setContinent] = useState("Tous les continents");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const profile = store.profiles.find((p) => p.id === store.activeId)!;
  const overall = summarizeProgress(
    allGames.map((game) => ({
      items: game.items,
      learning: learningForGame(profile, game),
    })),
  );
  const menuTheme = learningThemes.find((theme) => theme.id === route.themeId);
  const menuTopic = menuTheme?.topics.find(
    (topic) => topic.id === route.topicId,
  );
  const mode = profile.mode || "place";
  const progress = progressFor(profile);
  const learning = progress.learning;
  const session = progress.session || startSession(progress);
  const target = countryById.get(session.current.id)!;
  const focused = focusMode && page === "play";
  const acquired = countries.filter((c) => isMastered(learning.memory[c.id]));
  const discovered = countries.filter((c) => learning.memory[c.id]?.attempts);
  const learningCount = discovered.length - acquired.length;
  const currentBatchStart = Math.floor((learning.unlocked - 1) / 5) * 5;
  const batch = countries.slice(currentBatchStart, learning.unlocked);
  const batchAcquired = batch.filter(
    (c) => learning.memory[c.id]?.acquired,
  ).length;
  const nextBatch = countries.slice(learning.unlocked, learning.unlocked + 5);
  const streak = activityStreak(learning.daily);
  const precision = learning.attempts
    ? Math.round((learning.correct / learning.attempts) * 100)
    : 0;
  const feedback = session.feedback;
  const currentQuestion = session.answeredCount + (feedback ? 0 : 1);
  const level = Math.floor(learning.xp / 150) + 1;
  const selected = selectedId ? countryById.get(selectedId) : undefined;
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    try {
      saveStore(store);
    } catch {
      setStorageError(
        "La sauvegarde locale est indisponible. Exportez votre progression depuis les réglages avant de fermer.",
      );
    }
  }, [store]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onChange = () =>
      setNativeFullscreen(
        !!document.fullscreenElement &&
          document.fullscreenElement === shell.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!focused) {
      if (document.fullscreenElement === shell.current)
        void document.exitFullscreen().catch(() => {});
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement)
        setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focused]);
  useEffect(() => {
    if (page !== "play" || !feedback || dialog) return;
    const onSpace = (event: KeyboardEvent) => {
      if (
        (event.code !== "Space" && event.key !== " ") ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const target = event.target;
      if (target instanceof Element) {
        if (
          target.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"]',
          )
        )
          return;
        const control = target.closest("button, a");
        if (control && !control.hasAttribute("data-next-question")) return;
      }
      event.preventDefault();
      nextQuestion();
    };
    window.addEventListener("keydown", onSpace);
    return () => window.removeEventListener("keydown", onSpace);
  }, [page, feedback, dialog]);
  async function toggleFullscreen() {
    if (document.fullscreenElement === shell.current) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    setFocusMode(true);
    try {
      if (!shell.current?.requestFullscreen)
        throw new Error("Fullscreen unavailable");
      await shell.current.requestFullscreen();
    } catch {
      notify(
        "Le mode concentré reste actif dans cette fenêtre. Le plein écran n’est pas disponible dans ce navigateur.",
      );
    }
  }
  function updateProfile(fn: (p: Profile) => Profile) {
    setStore((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)),
    }));
  }
  function updateProgress(fn: (p: ProgressTrack) => ProgressTrack) {
    updateProfile((p) =>
      p.mode === "name"
        ? { ...p, naming: fn(progressFor(p)) }
        : { ...p, ...fn(p) },
    );
  }
  function switchMode(next: GameMode) {
    updateProfile((p) => changeGameMode(p, next));
  }
  function submit(selectedCountry: string | null, typedName?: string) {
    if (feedback) return;
    const nameMatch =
      mode === "name"
        ? evaluateCountryName(typedName || "", target.id)
        : undefined;
    const correct = nameMatch
      ? nameMatch === "exact"
      : selectedCountry === target.id;
    const next = recordAttempt(
      learning,
      countries,
      target.id,
      correct,
      session.hinted,
      Date.now(),
      nameMatch === "close",
    );
    const answer: Answer = {
      targetId: target.id,
      selectedId: selectedCountry,
      correct,
      assisted: session.hinted,
      unlocked: next.unlocked - learning.unlocked,
      ...(nameMatch ? { typedName: typedName || "", nameMatch } : {}),
    };
    updateProgress((p) => ({
      ...p,
      learning: next,
      session: recordSessionAnswer(session, answer),
    }));
    if (answer.unlocked)
      notify(
        `${answer.unlocked} nouveaux pays débloqués. Le voyage continue !`,
      );
  }
  function nextQuestion() {
    if (!feedback) return;
    updateProgress((p) => ({ ...p, session: nextSessionQuestion(p) }));
  }
  function requestHint() {
    if (feedback || session.hinted) return;
    updateProgress((p) => ({
      ...p,
      session: {
        ...session,
        hinted: true,
        hintIds: candidateCountries(countries, target.id, currentQuestion),
      },
    }));
  }
  function navigate(next: Page) {
    if (next === "play") setFocusMode(true);
    go({ page: next });
    setQuery("");
  }
  function openLibraryGame(
    game: LearningGame,
    destination: "play" | "game-progress",
  ) {
    switchMode(game.mode);
    navigate(destination);
  }
  function openSettings() {
    setRename(profile.name);
    setImportError("");
    setDialog("settings");
  }
  function switchProfile(id: string) {
    setStore((s) => ({
      ...s,
      activeId: id,
      profiles: s.profiles.map((p) =>
        p.id === id && !p.session ? { ...p, session: startSession(p) } : p,
      ),
    }));
    setDialog(null);
    navigate("library");
    setSelectedId(null);
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      date: d,
      key: dateKey(d.getTime()),
      value: learning.daily[dateKey(d.getTime())]?.attempts || 0,
    };
  });
  const filtered = countries.filter(
    (c) =>
      c.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(
          query
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase(),
        ) &&
      (continent === "Tous les continents" || c.continent === continent),
  );
  return (
    <div ref={shell} className={`app-shell ${focused ? "is-focused" : ""}`}>
      {focused && (
        <FocusControls
          fullscreen={nativeFullscreen}
          onExit={() => setFocusMode(false)}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("library")}
          aria-label="Élan, accueil"
        >
          <span className="brand-icon">
            <BrandMark size={27} />
          </span>
          <span>
            élan<span className="brand-dot">.</span>
            <small>LE SAVOIR EN MOUVEMENT</small>
          </span>
        </button>
        <div className="nav-label">VOTRE APPRENTISSAGE</div>
        <nav aria-label="Navigation principale">
          <button
            className={`nav-item ${page === "library" ? "active" : ""}`}
            onClick={() => navigate("library")}
            aria-label="Thèmes"
          >
            <Layers3 size={19} />
            <span>Thèmes</span>
            {page === "library" && <span className="nav-active-dot" />}
          </button>
          <button
            className={`nav-item ${page === "play" ? "active" : ""}`}
            onClick={() => navigate("play")}
            aria-label="Reprendre le jeu"
          >
            <Play size={19} />
            <span>Reprendre le jeu</span>
            {page === "play" && <span className="nav-active-dot" />}
          </button>
          <button
            className={`nav-item ${page === "progress" ? "active" : ""}`}
            onClick={() => navigate("progress")}
            aria-label="Ma progression"
          >
            <TrendingUp size={19} />
            <span>Ma progression</span>
          </button>
        </nav>
        <div className="sidebar-journey">
          <div className="journey-icon">
            <BookOpen size={22} />
            <Sparkles size={12} />
          </div>
          <h3>
            Un petit pas.
            <br />
            De grandes découvertes.
          </h3>
          <p>
            Quelques minutes chaque jour pour
            <br />
            apprendre à votre rythme.
          </p>
          <div className="journey-track">
            <i
              style={{
                width: `${Math.min(100, ((overall.daily[dateKey()]?.attempts || 0) / 10) * 100)}%`,
              }}
            />
          </div>
          <div className="journey-footer">
            <span>Objectif du jour</span>
            <b>{Math.min(overall.daily[dateKey()]?.attempts || 0, 10)} / 10</b>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setDialog("help")}>
            <CircleHelp size={18} />
            <span>Comment ça marche ?</span>
          </button>
          <button className="nav-item" onClick={openSettings}>
            <Settings2 size={18} />
            <span>Réglages</span>
          </button>
          <button
            className="profile-switch"
            onClick={() => {
              setProfileName("");
              setDialog("profiles");
            }}
          >
            <span className="avatar">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-copy">
              <b>{profile.name}</b>
              <small>
                Mon parcours · Niveau {Math.floor(overall.xp / 150) + 1}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <nav
            className="breadcrumb library-breadcrumb"
            aria-label="Fil d’Ariane"
          >
            <button
              onClick={() => navigate("library")}
              aria-current={
                page === "library" && !menuTheme ? "page" : undefined
              }
            >
              Thèmes
            </button>
            {((page !== "library" && page !== "progress") || menuTheme) && (
              <>
                <ChevronRight size={13} />
                <button
                  onClick={() =>
                    go({
                      page: "library",
                      themeId: menuTheme?.id || "geography",
                    })
                  }
                >
                  {menuTheme?.title || "Géographie"}
                </button>
              </>
            )}
            {((page !== "library" && page !== "progress") || menuTopic) && (
              <>
                <ChevronRight size={13} />
                <button
                  onClick={() =>
                    go({
                      page: "library",
                      themeId: menuTheme?.id || "geography",
                      topicId: menuTopic?.id || "world",
                    })
                  }
                >
                  {menuTopic?.title || "Le monde"}
                </button>
              </>
            )}
            {page !== "library" && (
              <>
                <ChevronRight size={13} />
                <b>
                  {page === "progress"
                    ? "Ma progression"
                    : page === "atlas"
                      ? "Pays du monde"
                      : `${page === "game-progress" ? "Suivi · " : ""}${mode === "place" ? "Placer" : "Nommer"}`}
                </b>
              </>
            )}
          </nav>
          <div className="topbar-right">
            <span className="streak-chip">
              <Flame size={16} />
              {activityStreak(overall.daily)}{" "}
              <span>
                jour{activityStreak(overall.daily) > 1 ? "s" : ""} de suite
              </span>
            </span>
            <span className="topbar-divider" />
            <button
              className="avatar avatar-small"
              onClick={() => setDialog("profiles")}
              aria-label="Changer de profil"
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main>
          {storageError && (
            <div className="storage-alert" role="alert">
              {storageError}
              <button onClick={() => downloadStore(store)}>
                Exporter mes progrès
              </button>
            </div>
          )}
          {page === "library" && (
            <LearningLibrary
              profile={profile}
              route={route}
              onBrowse={go}
              onPlay={(game) => openLibraryGame(game, "play")}
              onStats={(game) => openLibraryGame(game, "game-progress")}
              onOpenAtlas={() => navigate("atlas")}
            />
          )}
          {page === "progress" && (
            <GeneralProgress
              profile={profile}
              summary={overall}
              onGameProgress={(game) => openLibraryGame(game, "game-progress")}
              onPlay={(game) => openLibraryGame(game, "play")}
            />
          )}
          {(page === "play" ||
            page === "game-progress" ||
            page === "atlas") && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span />{" "}
                  {page === "play"
                    ? "LE GOÛT DE LA DÉCOUVERTE"
                    : page === "game-progress"
                      ? "CHAQUE PETIT PAS COMPTE"
                      : "VOTRE CARNET DU MONDE"}
                </div>
                <h1>
                  {page === "play"
                    ? "Un pays à la fois."
                    : page === "game-progress"
                      ? "Le chemin parcouru."
                      : "197 pays. Un seul monde."}
                </h1>
                <p>
                  {page === "play"
                    ? "Explorez le monde. Faites des erreurs. Retenez pour longtemps."
                    : page === "game-progress"
                      ? `${profile.name}, voici les connaissances que vous construisez.`
                      : "Un voyage des pays les plus peuplés aux plus petits États."}
                </p>
              </div>
              <div className="heading-badge">
                <span className="badge-icon">
                  <GraduationCap size={21} />
                </span>
                <span>
                  À votre rythme<b>Un parcours qui s’adapte à vous</b>
                </span>
              </div>
            </div>
          )}
          {page === "play" && (
            <>
              <section
                className="game-card"
                aria-label={
                  mode === "place"
                    ? "Jeu de placement des pays"
                    : "Jeu de nommage des pays"
                }
              >
                {!focused && (
                  <div className="game-toolbar">
                    <div>
                      <span className="section-icon">
                        <Compass size={19} />
                      </span>
                      <b>Votre expédition</b>
                      <span className="chapter-label">
                        Étape {Math.ceil(learning.unlocked / 5)}
                      </span>
                    </div>
                    <div className="question-progress">
                      <span>
                        Question{" "}
                        <b>{String(currentQuestion).padStart(2, "0")}</b>
                      </span>
                      <div className="question-ticks">
                        {Array.from({ length: 10 }, (_, i) => (
                          <i
                            key={i}
                            className={
                              i < session.answers.length
                                ? session.answers[i].correct
                                  ? "done"
                                  : "error"
                                : i === session.answers.length
                                  ? "current"
                                  : ""
                            }
                          />
                        ))}
                      </div>
                      <button
                        className="focus-fullscreen"
                        onClick={toggleFullscreen}
                        aria-label="Jouer en plein écran"
                      >
                        <Expand size={16} />
                        <span>Jouer en plein écran</span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="game-body">
                  {focused && mode === "place" && (
                    <FocusQuestion
                      country={target}
                      question={currentQuestion}
                      reason={reasons[session.current.reason]}
                      feedback={feedback}
                      hinted={session.hinted}
                      streak={learning.memory[target.id]?.streak || 0}
                      onHint={requestHint}
                      onSkip={() => submit(null)}
                      onNext={nextQuestion}
                      onMode={switchMode}
                    />
                  )}
                  {mode === "name" && (
                    <NamingQuestion
                      key={`${profile.id}-${currentQuestion}-${session.current.id}`}
                      country={target}
                      question={currentQuestion}
                      feedback={feedback}
                      streak={learning.memory[target.id]?.streak || 0}
                      focused={focused}
                      onMode={switchMode}
                      onAnswer={(value) => submit(null, value)}
                      onSkip={() => submit(null)}
                      onNext={nextQuestion}
                    />
                  )}
                  <WorldMap
                    learning={learning}
                    allowExpand={false}
                    feedback={feedback}
                    hintIds={session.hinted && !feedback ? session.hintIds : []}
                    onSelect={(id) => {
                      if (mode === "place") submit(id);
                    }}
                    namingTargetId={mode === "name" ? target.id : undefined}
                    questionId={`${profile.id}-${currentQuestion}-${session.current.id}`}
                  />
                  {!focused && mode === "place" && (
                    <div
                      className={`question-panel ${feedback ? "has-feedback" : ""}`}
                    >
                      <ModeSwitch mode={mode} onChange={switchMode} />
                      <div className="question-eyebrow">
                        <span
                          className={`reason-dot ${session.current.reason}`}
                        />
                        {reasons[session.current.reason]}
                      </div>
                      <div className="question-prompt">
                        <span className="country-flag-scene">
                          <CountryFlag country={target} large />
                          <i />
                          <i />
                        </span>
                        <span className="prompt-label">
                          {feedback
                            ? "VOTRE DESTINATION"
                            : "SAUREZ-VOUS PLACER…"}
                        </span>
                        <h2>
                          {target.name}
                          <span>{feedback ? "" : " ?"}</span>
                        </h2>
                        {!feedback && (
                          <p>
                            Cliquez sur son emplacement
                            <br />
                            sur la carte.
                          </p>
                        )}
                      </div>
                      {feedback ? (
                        <div className="feedback-block" aria-live="polite">
                          <div
                            className={`feedback-title ${feedback.correct ? "correct" : "incorrect"}`}
                          >
                            {feedback.correct ? (
                              <Check size={19} />
                            ) : (
                              <MapPin size={19} />
                            )}
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
                                ? "La prochaine fois, essayez sans indice pour consolider ce pays."
                                : "Un repère de plus dans votre mémoire."
                              : (feedback.selectedId
                                  ? `Vous avez choisi ${countryById.get(feedback.selectedId)?.name || "un autre territoire"}. `
                                  : "Pas de souci. ") +
                                `${target.name} est indiqué par le repère sur la carte.`}
                          </p>
                          <div className="country-facts">
                            <span>
                              <small>CAPITALE</small>
                              <b>{target.capital}</b>
                            </span>
                            <span>
                              <small>CONTINENT</small>
                              <b>{target.continent}</b>
                            </span>
                          </div>
                          <div className="feedback-mastery">
                            <span>
                              {isMastered(learning.memory[target.id])
                                ? "Pays acquis !"
                                : "Vers la maîtrise"}
                            </span>
                            <MiniProgress
                              value={learning.memory[target.id]?.streak}
                            />
                          </div>
                          <button
                            ref={focusAfterKeyboard}
                            className="button-primary next-button"
                            data-next-question=""
                            aria-keyshortcuts="Space"
                            onClick={nextQuestion}
                          >
                            Pays suivant
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      ) : (
                        <div className="question-actions">
                          {session.hinted ? (
                            <div className="hint-box" role="status">
                              <Lightbulb size={17} />
                              <span>
                                5 zones possibles sont repérées sur la carte.
                                <small>
                                  Cette réponse sera un entraînement guidé.
                                </small>
                              </span>
                            </div>
                          ) : (
                            <button
                              className="hint-button"
                              onClick={requestHint}
                            >
                              <Lightbulb size={17} /> Indice : 5 pays{" "}
                              <span>?</span>
                            </button>
                          )}
                          <button
                            className="skip-button"
                            onClick={() => submit(null)}
                          >
                            Je ne sais pas encore <ArrowRight size={14} />
                          </button>
                          <div className="no-pressure">
                            <ShieldCheck size={13} /> Ici, l’erreur fait partie
                            du voyage.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="game-footer">
                  <span>
                    <span className="mouse-icon" />{" "}
                    {mode === "name"
                      ? "Écrivez pour nommer"
                      : "Cliquez pour placer"}{" "}
                    <i>·</i> Deux doigts pour déplacer <i>·</i> Pincez pour
                    zoomer
                  </span>
                  <span>
                    <span className="tiny-live-dot" /> Progression{" "}
                    {storageError ? "à exporter" : "sauvegardée"}
                  </span>
                </div>
              </section>
              <section className="journey-card">
                <div className="journey-section-heading">
                  <div>
                    <span className="eyebrow">VOTRE HORIZON S’AGRANDIT</span>
                    <h2>
                      {learning.unlocked === 197
                        ? "Tous les pays sont à portée de main."
                        : learning.unlocked === 5
                          ? "Les grandes populations, pour commencer."
                          : `Étape ${Math.ceil(learning.unlocked / 5)} : de nouveaux repères.`}
                    </h2>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate("atlas")}
                  >
                    Voir le parcours <ArrowRight size={15} />
                  </button>
                </div>
                <div className="batch-row">
                  <div className="batch-countries">
                    {batch.map((c) => (
                      <div className="batch-country" key={c.id}>
                        <div
                          className={`batch-flag ${isMastered(learning.memory[c.id]) ? "mastered" : ""}`}
                        >
                          <CountryFlag country={c} />
                          {isMastered(learning.memory[c.id]) && (
                            <span>
                              <Check size={9} />
                            </span>
                          )}
                        </div>
                        <b>{c.name}</b>
                        <MiniProgress value={learning.memory[c.id]?.streak} />
                      </div>
                    ))}
                  </div>
                  {nextBatch.length > 0 && (
                    <>
                      <div className="batch-connector">
                        <span />
                        <ChevronRight size={15} />
                      </div>
                      <div className="next-batch">
                        <div className="next-flags">
                          {nextBatch.slice(0, 3).map((c) => (
                            <span key={c.id}>{flag(c)}</span>
                          ))}
                          <span className="next-lock">
                            <LockKeyhole size={15} />
                          </span>
                        </div>
                        <div>
                          <b>Prochaine escale</b>
                          <p>
                            {nextBatch.length} pays à débloquer{" "}
                            <span>
                              · {batchAcquired}/{batch.length} acquis
                            </span>
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="journey-note">
                  <Sparkles size={14} />
                  <span>
                    3 bonnes réponses consécutives, sans indice, pour acquérir
                    un pays. Puis de nouveaux horizons s’ouvrent.
                  </span>
                </div>
              </section>
              <div className="stat-grid">
                <Stat
                  icon={<Globe2 size={21} />}
                  value={acquired.length}
                  suffix="/ 197"
                  label="Pays acquis"
                  detail="Votre monde s’agrandit"
                  color="purple"
                />
                <Stat
                  icon={<Layers3 size={21} />}
                  value={learningCount}
                  label="Pays en apprentissage"
                  detail="Des repères qui se construisent"
                  color="blue"
                />
                <Stat
                  icon={<Target size={21} />}
                  value={learning.attempts ? `${precision} %` : "—"}
                  label="Précision globale"
                  detail={
                    learning.attempts
                      ? `${learning.correct} bonnes réponses sur ${learning.attempts}`
                      : "Votre première réponse vous attend"
                  }
                  color="peach"
                />
              </div>
              <div className="learning-note">
                <span>
                  <Sparkles size={16} /> Un apprentissage qui vous ressemble
                </span>
                <p>
                  Les pays difficiles reviennent plus souvent. Ceux que vous
                  connaissez ne sont jamais oubliés.
                </p>
                <button
                  onClick={() => setDialog("help")}
                  aria-label="Comprendre la méthode"
                >
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </>
          )}
          {page === "game-progress" && (
            <>
              <div className="progress-mode">
                <ModeSwitch mode={mode} onChange={switchMode} />
                <p>
                  Progression « {mode === "name" ? "Nommer" : "Placer"} » ·
                  Chaque variante garde ses acquis et ses révisions.
                </p>
                {mode === "name" && (
                  <span className="near-miss-total">
                    {Object.values(learning.memory).reduce(
                      (total, memory) => total + (memory.nearMisses || 0),
                      0,
                    )}{" "}
                    réponses proches · comptées comme erreurs, révisées plus
                    doucement
                  </span>
                )}
              </div>
              <div className="stat-grid four">
                <Stat
                  icon={<Trophy size={21} />}
                  value={acquired.length}
                  suffix="/ 197"
                  label="Pays acquis"
                  detail={`${learning.unlocked} pays débloqués`}
                  color="purple"
                />
                <Stat
                  icon={<Target size={21} />}
                  value={learning.attempts ? `${precision} %` : "—"}
                  label="Précision"
                  detail={`${learning.attempts} réponses enregistrées`}
                  color="peach"
                />
                <Stat
                  icon={<Flame size={21} />}
                  value={streak}
                  label="Jours de suite"
                  detail="Une petite habitude, de grands progrès"
                  color="peach"
                />
                <Stat
                  icon={<Zap size={21} />}
                  value={learning.xp}
                  suffix="XP"
                  label={`Niveau ${level}`}
                  detail={`${150 - (learning.xp % 150)} XP avant le prochain niveau`}
                  color="blue"
                />
              </div>
              <div className="progress-panels">
                <section className="white-panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">LA FORCE DE L’HABITUDE</span>
                      <h2>Vos 7 derniers jours</h2>
                    </div>
                    <span className="soft-chip">
                      {week.reduce((n, d) => n + d.value, 0)} réponses
                    </span>
                  </div>
                  <div className="activity-chart">
                    {week.map((d) => (
                      <div className="chart-column" key={d.key}>
                        <span>{d.value}</span>
                        <div className="bar-track">
                          <i
                            style={{
                              height: `${Math.max(2, (d.value / Math.max(10, ...week.map((w) => w.value))) * 100)}%`,
                            }}
                            className={d.key === dateKey() ? "today" : ""}
                          />
                        </div>
                        <small>
                          {d.date.toLocaleDateString("fr", {
                            weekday: "short",
                          })}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="white-panel recall-panel">
                  <span className="icon-tile purple">
                    <BookOpen size={22} />
                  </span>
                  <h2>Votre mémoire a son rythme.</h2>
                  <p>
                    {discovered.length
                      ? `${
                          countries.filter((c) => {
                            const m = learning.memory[c.id];
                            return m?.attempts && !isMastered(m);
                          }).length
                        } pays à consolider. Le prochain entraînement les mélangera avec vos découvertes et vos révisions.`
                      : "Votre premier voyage commence avec 5 pays. Vos réussites et vos erreurs dessineront la suite du parcours."}
                  </p>
                  <button
                    className="button-primary"
                    onClick={() => navigate("play")}
                  >
                    Reprendre l’exploration <ArrowRight size={17} />
                  </button>
                </section>
              </div>
              <section className="white-panel country-progress">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      VOS CONNAISSANCES, PAYS PAR PAYS
                    </span>
                    <h2>Les repères qui restent</h2>
                  </div>
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      placeholder="Rechercher un pays…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Rechercher dans la progression"
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Pays</th>
                        <th>Statut</th>
                        <th>Réussites</th>
                        <th>Erreurs</th>
                        <th>Maîtrise</th>
                        <th>Prochaine révision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered
                        .filter((c) => countries.indexOf(c) < learning.unlocked)
                        .map((c) => {
                          const m = learning.memory[c.id],
                            status = statusOf(m);
                          return (
                            <tr key={c.id}>
                              <td>
                                <CountryFlag country={c} />
                                <b>{c.name}</b>
                              </td>
                              <td>
                                <span className={`status-badge ${status}`}>
                                  {statusLabels[status]}
                                </span>
                              </td>
                              <td>{m?.correct || 0}</td>
                              <td>{m?.errors || 0}</td>
                              <td>
                                <MiniProgress value={m?.streak} />
                              </td>
                              <td>
                                {!m?.attempts
                                  ? "Première découverte"
                                  : m.due <= Date.now()
                                    ? "À revoir maintenant"
                                    : new Date(m.due).toLocaleString("fr", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {!filtered.some(
                  (c) => countries.indexOf(c) < learning.unlocked,
                ) && (
                  <p className="empty-state">
                    Aucun pays débloqué ne correspond à cette recherche.
                  </p>
                )}
              </section>
            </>
          )}
          {page === "atlas" && (
            <>
              <section className="atlas-map-card">
                <WorldMap
                  learning={learning}
                  onSelect={(id) => {
                    if (countryById.has(id)) setSelectedId(id);
                  }}
                  explore
                  selectedId={selectedId}
                />
                <div className="atlas-detail">
                  {selected ? (
                    <>
                      <CountryFlag country={selected} large />
                      <span className="eyebrow">{selected.continent}</span>
                      <h2>{selected.name}</h2>
                      <dl>
                        <div>
                          <dt>Capitale</dt>
                          <dd>{selected.capital}</dd>
                        </div>
                        <div>
                          <dt>Population estimée</dt>
                          <dd>{population(selected.population)}</dd>
                        </div>
                        <div>
                          <dt>Rang du parcours</dt>
                          <dd>#{countries.indexOf(selected) + 1} / 197</dd>
                        </div>
                      </dl>
                      <span
                        className={`status-badge ${countries.indexOf(selected) >= learning.unlocked ? "new" : statusOf(learning.memory[selected.id])}`}
                      >
                        {countries.indexOf(selected) >= learning.unlocked
                          ? "À débloquer dans le jeu"
                          : statusLabels[
                              statusOf(learning.memory[selected.id])
                            ]}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="atlas-globe">
                        <Globe2 size={54} strokeWidth={1} />
                      </span>
                      <h2>Le monde à portée de clic.</h2>
                      <p>
                        Sélectionnez un pays sur la carte ou dans le catalogue
                        pour le découvrir.
                      </p>
                      <span className="soft-chip">
                        {learning.unlocked} / 197 pays débloqués
                      </span>
                    </>
                  )}
                </div>
              </section>
              <div className="catalog-heading">
                <div>
                  <h2>Votre prochain horizon</h2>
                  <p>
                    Classés par population décroissante · {filtered.length} pays
                  </p>
                </div>
                <div className="catalog-filters">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      placeholder="Rechercher un pays…"
                      aria-label="Rechercher dans l’atlas"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filtrer par continent"
                    value={continent}
                    onChange={(e) => setContinent(e.target.value)}
                  >
                    {[
                      "Tous les continents",
                      "Afrique",
                      "Amérique du Nord",
                      "Amérique du Sud",
                      "Asie",
                      "Europe",
                      "Océanie",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="country-catalog">
                {filtered.map((c) => {
                  const index = countries.indexOf(c),
                    locked = index >= learning.unlocked;
                  return (
                    <button
                      key={c.id}
                      className={`catalog-country ${selectedId === c.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedId(c.id);
                        document
                          .querySelector(".atlas-map-card")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      <div className="catalog-country-top">
                        <CountryFlag country={c} />
                        <span>#{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <h3>{c.name}</h3>
                      <p>
                        {c.continent} <span>·</span> {population(c.population)}{" "}
                        hab.
                      </p>
                      <div className="catalog-country-bottom">
                        {locked ? (
                          <span>
                            <LockKeyhole size={12} /> Étape{" "}
                            {Math.floor(index / 5) + 1}
                          </span>
                        ) : (
                          <span
                            className={`catalog-status ${statusOf(learning.memory[c.id])}`}
                          >
                            {statusLabels[statusOf(learning.memory[c.id])]}
                          </span>
                        )}
                        <MiniProgress value={learning.memory[c.id]?.streak} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {!filtered.length && (
                <p className="empty-state">
                  Aucun pays ne correspond à votre recherche.
                </p>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <BrandMark size={15} /> Élan · Le savoir en mouvement.
            </span>
            <button onClick={() => setDialog("help")}>
              Méthode & sources <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {dialog === "help" && (
        <Modal
          title="De la curiosité à la mémoire."
          onClose={() => setDialog(null)}
        >
          <div className="method-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Choisissez ce que vous voulez apprendre</h3>
                <p>
                  Ouvrez un thème, puis un sous-thème et choisissez un jeu.
                  Placer un pays et retrouver son nom sont deux compétences
                  distinctes, chacune avec son propre suivi.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Une réponse, une correction immédiate</h3>
                <p>
                  Chaque jeu montre la bonne réponse après votre essai. Pour les
                  pays, vous pouvez demander un indice à cinq choix pendant le
                  placement. Une aide facilite l’entraînement sans valider la
                  maîtrise.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Progressez à votre rythme</h3>
                <p>
                  Dans les jeux du monde, 3 réponses correctes consécutives sans
                  indice rendent un pays acquis. Quand tous les pays du groupe
                  sont acquis, 5 autres se débloquent. Les acquis de chaque jeu
                  restent séparés.
                </p>
              </section>
            </div>
            <div>
              <span>04</span>
              <section>
                <h3>Révisez au bon moment</h3>
                <p>
                  Les erreurs reviennent plus souvent. Les pays acquis sont
                  aussi revus régulièrement, avec des intervalles qui
                  s’allongent. La bibliothèque montre votre progression générale
                  et celle de chaque jeu. Cette méthode est une règle
                  pédagogique, pas une mesure scientifique de votre mémoire.
                </p>
              </section>
            </div>
          </div>
          <div className="sources-box">
            <h3>Sources du thème Géographie</h3>
            <p>{source.scope}</p>
            <p>
              {source.populationNote} Données intégrées le{" "}
              {new Date(source.retrievedAt + "T12:00:00").toLocaleDateString(
                "fr",
              )}
              .
            </p>
            <p>
              Sources :{" "}
              <a
                href="https://github.com/restcountries/restcountries"
                target="_blank"
                rel="noreferrer"
              >
                REST Countries
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/topojson/world-atlas"
                target="_blank"
                rel="noreferrer"
              >
                World Atlas
              </a>{" "}
              ·{" "}
              <a
                href="https://www.naturalearthdata.com/about/terms-of-use/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth
              </a>
            </p>
            <p>
              Utilisation au clavier : Tab pour parcourir les zones, Entrée ou
              Espace pour répondre. Le nom des zones est masqué pendant le jeu.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "profiles" && (
        <Modal title="À chacun son voyage." onClose={() => setDialog(null)}>
          <p className="modal-intro">
            Chaque profil conserve sa progression sur ce navigateur.
          </p>
          <div className="profiles-list">
            {store.profiles.map((p) => (
              <button key={p.id} onClick={() => switchProfile(p.id)}>
                <span className="avatar">{p.name[0].toUpperCase()}</span>
                <span>
                  <b>{p.name}</b>
                  <small>
                    {
                      Object.values(progressFor(p).learning.memory).filter(
                        isMastered,
                      ).length
                    }{" "}
                    pays acquis · {progressFor(p).learning.xp} XP ·{" "}
                    {p.mode === "name" ? "Nommer" : "Placer"}
                  </small>
                </span>
                {p.id === profile.id ? (
                  <Check size={19} />
                ) : (
                  <ArrowRight size={17} />
                )}
              </button>
            ))}
          </div>
          {store.profiles.length < 30 && (
            <form
              className="new-profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!profileName.trim()) return;
                const p = makeProfile(profileName);
                p.session = startSession(p);
                setStore((s) => ({
                  ...s,
                  activeId: p.id,
                  profiles: [...s.profiles, p],
                }));
                setDialog(null);
                navigate("library");
                setSelectedId(null);
                notify(`Bienvenue ${p.name}. Votre voyage commence !`);
              }}
            >
              <label htmlFor="new-profile">Un nouvel explorateur ?</label>
              <div>
                <input
                  id="new-profile"
                  maxLength={32}
                  required
                  placeholder="Votre prénom ou pseudo"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
                <button className="button-primary" type="submit">
                  <Plus size={17} /> Créer
                </button>
              </div>
            </form>
          )}
          <div className="profile-utilities">
            <button className="button-secondary" onClick={openSettings}>
              <Settings2 size={15} /> Réglages et sauvegarde
            </button>
            <button className="button-quiet" onClick={() => setDialog("help")}>
              Comment apprendre ?
            </button>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <span>
              Aucun compte, aucun envoi de données. Pensez à exporter vos
              progrès pour les retrouver ailleurs.
            </span>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal
          title="Votre espace d’exploration."
          onClose={() => setDialog(null)}
        >
          <form
            className="rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!rename.trim()) return;
              updateProfile((p) => ({ ...p, name: rename.trim() }));
              notify("Votre nom a été mis à jour.");
            }}
          >
            <label htmlFor="rename">Nom de l’explorateur</label>
            <div>
              <input
                id="rename"
                value={rename}
                onChange={(e) => setRename(e.target.value)}
                required
                maxLength={32}
              />
              <button className="button-primary" type="submit">
                Enregistrer
              </button>
            </div>
          </form>
          <section className="settings-section">
            <h3>
              <ShieldCheck size={18} /> Vos progrès vous appartiennent.
            </h3>
            <p>
              Les profils, les réponses et la session en cours sont sauvegardés
              sur ce navigateur. Exportez-les pour les transférer ou les
              conserver.
            </p>
            <div className="settings-actions">
              <button
                className="button-secondary"
                onClick={() => {
                  downloadStore(store);
                  notify("Votre sauvegarde a été exportée.");
                }}
              >
                <ArrowDownToLine size={17} /> Exporter
              </button>
              <button
                className="button-secondary"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={17} /> Importer
              </button>
            </div>
            <p className="input-note">
              L’import ajoute les profils sous de nouveaux identifiants. Vos
              profils actuels sont conservés.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInput}
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 10_000_000) throw Error("10 Mo maximum.");
                  const imported = parseStore(await file.text());
                  if (store.profiles.length + imported.profiles.length > 30)
                    throw Error("30 profils maximum.");
                  const profiles = imported.profiles.map((p) => ({
                    ...p,
                    id: crypto.randomUUID(),
                    name: p.name.slice(0, 24) + " (import)",
                  }));
                  setStore((s) => ({
                    ...s,
                    profiles: [...s.profiles, ...profiles],
                  }));
                  setImportError("");
                  notify(
                    `${profiles.length} profil(s) importé(s). Retrouvez-les dans le sélecteur de profils.`,
                  );
                } catch (err) {
                  setImportError(
                    err instanceof Error ? err.message : "Import impossible.",
                  );
                } finally {
                  e.target.value = "";
                }
              }}
            />
            {importError && (
              <p className="error-message" role="alert">
                {importError}
              </p>
            )}
          </section>
          <div className="privacy-note">
            <Users size={18} />
            <span>
              Vous partagez cet appareil ? Créez un profil par personne avec le
              sélecteur en bas du menu.
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default App;
