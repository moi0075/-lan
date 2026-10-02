import AccountPanel, { type FormMode } from "./auth/AccountPanel";
import PseudoEditor from "./auth/PseudoEditor";
import WelcomePseudo from "./auth/WelcomePseudo";
import { useAccount } from "./auth/AccountContext";
import { MiniProgress, CountryFlag, Stat } from "./components/LearningUI";
import { useEffect, useRef, useState } from "react";
import FocusQuestion from "./components/FocusQuestion";
import FocusControls from "./components/FocusControls";
import NamingQuestion from "./components/NamingQuestion";
import LearningLibrary from "./components/LearningLibrary";
import GeneralProgress from "./components/GeneralProgress";
import Leaderboard from "./components/Leaderboard";
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
import { candidateCountries } from "./engine/hints";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Flame,
  Globe2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  Play,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import WorldMap from "./components/WorldMap";
import Modal from "./components/Modal";
import { countries, countryById, population } from "./data/catalog";
import source from "./data/source.json";
import {
  activityStreak,
  dateKey,
  isMastered,
  recordAttempt,
  statusOf,
} from "./engine/learning";
import {
  GUEST_STORAGE_KEY,
  loadStore,
  saveStore,
  startSession,
  recordSessionAnswer,
  nextSessionQuestion,
  progressFor,
  changeGameMode,
  type ProgressTrack,
  type Answer,
  type Profile,
  type Store,
} from "./engine/storage";

type Dialog = "help" | "settings" | "account" | null;
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
function App({
  storageKey = GUEST_STORAGE_KEY,
  initialStore,
  onStoreChange,
}: {
  storageKey?: string;
  initialStore?: Store;
  onStoreChange?: (store: Store) => void;
}) {
  const account = useAccount();
  const initial = useRef<ReturnType<typeof loadStore> | null>(null);
  if (!initial.current)
    initial.current = initialStore
      ? { store: initialStore }
      : loadStore(storageKey);
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
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [accountForm, setAccountForm] = useState<FormMode>("login");
  useEffect(() => {
    if (account.recovering) setDialog("account");
  }, [account.recovering]);
  const [toast, setToast] = useState("");
  const [rename, setRename] = useState("");
  const [query, setQuery] = useState("");
  const [continent, setContinent] = useState("Tous les continents");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const routeGame = allGames.find((game) => game.id === route.gameId);
  const mode = routeGame?.mode || profile.mode || "place";
  const progress = progressFor(changeGameMode(profile, mode));
  const learning = progress.learning;
  const session = progress.session || startSession(progress);
  const target = countryById.get(session.current.id)!;
  const focused = page === "play";
  const acquired = countries.filter((c) => isMastered(learning.memory[c.id]));
  const discovered = countries.filter((c) => learning.memory[c.id]?.attempts);
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
    if (page !== "play" && page !== "game-progress") return;
    if (!route.gameId) {
      const game = allGames.find((item) => item.mode === mode)!;
      go({ page, gameId: game.id }, true);
    }
    if (
      (profile.mode || "place") !== mode ||
      (mode === "name" && !profile.naming)
    ) {
      updateProfile((p) => changeGameMode(p, mode));
    }
  }, [page, route.gameId, profile.id, profile.mode, mode]);
  useEffect(() => {
    try {
      saveStore(store, storageKey);
      onStoreChange?.(store);
    } catch {
      setStorageError(
        "La sauvegarde locale est indisponible. Vos dernières réponses ne pourront pas être conservées sur cet appareil.",
      );
    }
  }, [store, storageKey, onStoreChange]);
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
      if (event.key === "Escape" && !document.fullscreenElement) leaveGame();
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
  function changePseudo(name: string) {
    updateProfile((p) => ({ ...p, name }));
  }
  function updateProgress(fn: (p: ProgressTrack) => ProgressTrack) {
    updateProfile((p) => {
      const active = changeGameMode(p, mode);
      return mode === "name"
        ? { ...active, naming: fn(progressFor(active)) }
        : { ...active, ...fn(active) };
    });
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
  function leaveGame() {
    go({ page: "library", themeId: "geography", topicId: "world" });
  }
  function navigate(next: Page) {
    const gameId =
      next === "play" || next === "game-progress"
        ? routeGame?.id || allGames.find((game) => game.mode === mode)!.id
        : undefined;
    go({ page: next, gameId });
    setQuery("");
  }
  function openLibraryGame(
    game: LearningGame,
    destination: "play" | "game-progress",
  ) {
    updateProfile((p) => changeGameMode(p, game.mode));
    go({ page: destination, gameId: game.id });
    setQuery("");
  }
  function openAccount() {
    account.clearError();
    setAccountForm("login");
    setDialog("account");
  }
  function openSettings() {
    setRename(profile.name);
    setDialog("settings");
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
          onExit={leaveGame}
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
          <button
            className={`nav-item ${page === "leaderboard" ? "active" : ""}`}
            onClick={() => navigate("leaderboard")}
            aria-label="Classement"
          >
            <Trophy size={19} />
            <span>Classement</span>
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
          <button className="account-summary" onClick={openAccount}>
            <span className="avatar">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-summary-copy">
              <b>{profile.name}</b>
              <small>
                Mon parcours · Niveau {Math.floor(overall.xp / 150) + 1}
              </small>
            </span>
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
            {((page !== "library" &&
              page !== "progress" &&
              page !== "leaderboard") ||
              menuTheme) && (
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
            {((page !== "library" &&
              page !== "progress" &&
              page !== "leaderboard") ||
              menuTopic) && (
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
                    : page === "leaderboard"
                      ? "Classement"
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
            <button
              className="account-nav button-secondary"
              onClick={openAccount}
            >
              {account.user ? "Mon compte" : "Se connecter"}
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar avatar-small"
              onClick={openAccount}
              aria-label={
                account.user ? "Ouvrir mon compte" : "Ouvrir la connexion"
              }
            >
              {profile.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main>
          {storageError && (
            <div className="storage-alert" role="alert">
              {storageError}
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
          {page === "leaderboard" && (
            <Leaderboard
              onSignIn={openAccount}
              onNameChange={changePseudo}
              profileName={profile.name}
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
          {(page === "game-progress" || page === "atlas") && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span />{" "}
                  {page === "game-progress"
                    ? "CHAQUE PETIT PAS COMPTE"
                    : "VOTRE CARNET DU MONDE"}
                </div>
                <h1>
                  {page === "game-progress"
                    ? "Le chemin parcouru."
                    : "197 pays. Un seul monde."}
                </h1>
                <p>
                  {page === "game-progress"
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
            <section
              className="game-card"
              aria-label={
                mode === "place"
                  ? "Jeu de placement des pays"
                  : "Jeu de nommage des pays"
              }
            >
              <div className="game-body">
                {mode === "place" ? (
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
                  />
                ) : (
                  <NamingQuestion
                    key={`${profile.id}-${currentQuestion}-${session.current.id}`}
                    country={target}
                    question={currentQuestion}
                    feedback={feedback}
                    streak={learning.memory[target.id]?.streak || 0}
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
              </div>
            </section>
          )}
          {page === "game-progress" && (
            <>
              <div className="progress-mode">
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
      <WelcomePseudo enabled={!dialog && !focused} onSaved={changePseudo} />
      {dialog === "account" && (
        <Modal
          title={
            account.recovering
              ? "Nouveau mot de passe"
              : account.user
                ? "Mon compte"
                : {
                    login: "Se connecter",
                    signup: "Créer un compte",
                    reset: "Mot de passe oublié",
                  }[accountForm]
          }
          onClose={() => setDialog(null)}
        >
          <AccountPanel
            onModeChange={setAccountForm}
            onNameChange={changePseudo}
          />
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="Réglages" onClose={() => setDialog(null)}>
          {account.user ? (
            <PseudoEditor onSaved={changePseudo} />
          ) : (
            <form
              className="rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!rename.trim()) return;
                updateProfile((p) => ({ ...p, name: rename.trim() }));
                notify("Votre nom a été mis à jour.");
              }}
            >
              <label htmlFor="rename">Nom affiché</label>
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
          )}
        </Modal>
      )}
    </div>
  );
}
export default App;
