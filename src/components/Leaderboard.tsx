import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Medal,
  Pencil,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import { learningThemes } from "../catalog/learningCatalog";
import { useAccount } from "../auth/AccountContext";
import {
  PAGE_SIZE,
  publicIdentity,
  publicNameError,
  readLeaderboard,
  type LeaderboardResult,
  type LeaderboardSort,
  type PublicPlayer,
} from "../leaderboard/api";

const number = new Intl.NumberFormat("fr-FR");
const precision = (value: number | null) =>
  value === null ? "—" : `${number.format(Math.round(value))} %`;
const sortLabels: Record<LeaderboardSort, string> = {
  xp: "Points d’expérience",
  mastered: "Connaissances acquises",
  accuracy: "Précision",
  attempts: "Nombre de réponses",
};

export default function Leaderboard({
  onSignIn,
  onNameChange,
  profileName,
}: {
  onSignIn: () => void;
  onNameChange: (name: string) => void;
  profileName: string;
}) {
  const account = useAccount();
  const [theme, setTheme] = useState("");
  const [game, setGame] = useState("");
  const [sort, setSort] = useState<LeaderboardSort>("xp");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [identity, setIdentity] = useState<PublicPlayer | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const games = learningThemes
    .filter((item) => !theme || item.id === theme)
    .flatMap((item) =>
      item.topics.flatMap((topic) =>
        topic.games.map((entry) => ({
          ...entry,
          label: `${topic.title} · ${entry.title}`,
        })),
      ),
    );
  const selectedTheme = learningThemes.find((item) => item.id === theme);
  const scope =
    games.find((item) => item.id === game)?.label ||
    selectedTheme?.title ||
    "Tous les savoirs";
  const userId = account.user?.id;
  const cloudSaved = account.status === "saved";

  useEffect(() => {
    setIdentity(null);
    setIdentityError("");
    if (!userId) return;
    const controller = new AbortController();
    publicIdentity(
      AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    )
      .then((player) => {
        if (!controller.signal.aborted) setIdentity(player);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setIdentityError("Votre pseudo n’a pas pu être chargé.");
      });
    return () => controller.abort();
  }, [userId, refresh, cloudSaved, profileName]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    // Cancel both the debounce and the request when any filter changes.
    const timer = window.setTimeout(
      () => {
        readLeaderboard(
          {
            theme,
            game,
            search,
            sort,
            offset: page * PAGE_SIZE,
            self: identity?.player_id ?? null,
          },
          AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
        )
          .then((data) => {
            if (controller.signal.aborted) return;
            if (page > 0 && data.total <= page * PAGE_SIZE) {
              setPage(0);
              return;
            }
            setResult(data);
            setLoading(false);
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setError("Le classement ne peut pas être chargé pour le moment.");
              setLoading(false);
            }
          });
      },
      search ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    theme,
    game,
    search,
    sort,
    page,
    identity?.player_id,
    refresh,
    cloudSaved,
  ]);

  function resetFilters() {
    setTheme("");
    setGame("");
    setSort("xp");
    setSearch("");
    setPage(0);
  }
  async function saveName(event: FormEvent) {
    event.preventDefault();
    const invalid = publicNameError(name);
    if (invalid) {
      setNameMessage(invalid);
      return;
    }
    setSaving(true);
    setNameMessage("");
    try {
      const player = await publicIdentity(AbortSignal.timeout(12000), name);
      if (!player) throw Error("Compte indisponible");
      setIdentity(player);
      onNameChange(player.display_name);
      setEditing(false);
      setNameMessage("Votre pseudo public a été enregistré.");
      setRefresh((value) => value + 1);
    } catch {
      setNameMessage("Le pseudo n’a pas pu être enregistré. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="leaderboard-page">
      <div className="leaderboard-hero">
        <div>
          <div className="eyebrow">
            <span /> APPRENDRE ENSEMBLE
          </div>
          <h1>Chaque progrès compte.</h1>
          <p>
            Retrouvez les joueurs d’Élan et comparez vos avancées dans les
            savoirs qui vous intéressent.
          </p>
          <div className="leaderboard-hero-tags">
            <span>
              <Users size={15} /> Tous les joueurs
            </span>
            <span>
              <Trophy size={15} /> Classement général
            </span>
          </div>
        </div>
        <div className="leaderboard-emblem" aria-hidden="true">
          <Trophy size={44} strokeWidth={1.5} />
          <span>Un pas de plus.</span>
        </div>
      </div>

      <div className="leaderboard-personal">
        {userId ? (
          <>
            <div className="leaderboard-personal-icon">
              <Medal size={25} />
            </div>
            <div className="leaderboard-personal-copy">
              <small>VOTRE PLACE · {scope}</small>
              <b>{identity?.display_name || "Votre compte"}</b>
              <span>
                {!loading && !error && result?.mine
                  ? `${number.format(result.mine.rank)}${result.mine.rank === 1 ? "er" : "e"} · ${number.format(result.mine.xp)} XP · ${result.mine.mastered} acquis`
                  : "Votre meilleur parcours est représenté ici."}
              </span>
            </div>
            {identity && (
              <button
                className="button-secondary"
                onClick={() => {
                  setName(identity.display_name);
                  setNameMessage("");
                  setEditing(!editing);
                }}
                aria-expanded={editing}
              >
                <Pencil size={15} /> Mon pseudo public
              </button>
            )}
            {identityError && (
              <span role="alert">
                {identityError}{" "}
                <button
                  className="text-button"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  Réessayer
                </button>
              </span>
            )}
          </>
        ) : (
          <>
            <div className="leaderboard-personal-icon">
              <Medal size={25} />
            </div>
            <div className="leaderboard-personal-copy">
              <b>Une place pour vos progrès.</b>
              <span>
                Connectez-vous pour retrouver votre position et apparaître dans
                le classement.
              </span>
            </div>
            <button className="button-primary" onClick={onSignIn}>
              Se connecter avec Google <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
      {editing && (
        <form className="leaderboard-name-form" onSubmit={saveName}>
          <div>
            <label htmlFor="public-player-name">Votre pseudo public</label>
            <p>
              Visible par tous. Votre adresse e-mail et vos profils restent
              privés.
            </p>
          </div>
          <input
            id="public-player-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={32}
            autoComplete="nickname"
            required
          />
          <button className="button-primary" disabled={saving}>
            <Check size={16} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            Annuler
          </button>
        </form>
      )}
      {nameMessage && (
        <p className="leaderboard-name-message" role="status">
          {nameMessage}
        </p>
      )}

      <div className="leaderboard-board">
        <div className="leaderboard-filters">
          <label>
            Thème
            <select
              aria-label="Thème"
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value);
                setGame("");
                setPage(0);
              }}
            >
              <option value="">Tous les thèmes</option>
              {learningThemes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jeu
            <select
              aria-label="Jeu"
              value={game}
              onChange={(event) => {
                setGame(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Tous les jeux</option>
              {games.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Classer par
            <select
              aria-label="Classer par"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as LeaderboardSort);
                setPage(0);
              }}
            >
              {Object.entries(sortLabels).map(([value, title]) => (
                <option key={value} value={value}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="leaderboard-search">
            Rechercher un joueur
            <span>
              <Search size={18} />
              <input
                type="search"
                placeholder="Son pseudo…"
                value={search}
                maxLength={80}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </span>
          </label>
        </div>
        <div className="leaderboard-table-heading">
          <div>
            <h2>{scope}</h2>
            <p>
              {sortLabels[sort]} · Les joueurs à égalité partagent le même rang.
            </p>
          </div>
          <button
            className="leaderboard-refresh"
            aria-label="Actualiser le classement"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div aria-live="polite" className="leaderboard-status">
          {loading
            ? "Mise à jour du classement…"
            : error
              ? ""
              : `${number.format(result?.total ?? 0)} joueur${result?.total === 1 ? "" : "s"}${search.trim() ? ` trouvé${result?.total === 1 ? "" : "s"}` : ""}`}
        </div>
        {error ? (
          <div className="leaderboard-empty" role="alert">
            <Trophy size={30} />
            <h3>Un peu de patience.</h3>
            <p>{error}</p>
            <button
              className="button-secondary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div className="leaderboard-loading" aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <div key={item}>
                <i />
                <span />
                <b />
              </div>
            ))}
          </div>
        ) : result?.rows.length ? (
          <>
            <div
              className="leaderboard-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Classement des joueurs, défilement horizontal disponible"
            >
              <table className="leaderboard-table">
                <caption className="sr-only">
                  Classement {scope}, trié par {sortLabels[sort]}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Rang</th>
                    <th scope="col">Joueur</th>
                    <th scope="col">XP</th>
                    <th scope="col">Acquis</th>
                    <th scope="col">Précision</th>
                    <th scope="col">Réponses</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr
                      key={row.player_id}
                      className={
                        row.player_id === identity?.player_id
                          ? "leaderboard-self"
                          : ""
                      }
                    >
                      <td>
                        <span
                          className={`leaderboard-rank ${row.rank <= 3 ? `rank-${row.rank}` : ""}`}
                        >
                          {row.rank <= 3 && (
                            <Medal size={15} aria-hidden="true" />
                          )}
                          {number.format(row.rank)}
                        </span>
                      </td>
                      <th scope="row">
                        <span className="leaderboard-player">
                          <span
                            className="leaderboard-avatar"
                            aria-hidden="true"
                          >
                            {Array.from(row.display_name)[0]?.toUpperCase()}
                          </span>
                          <span>
                            {row.display_name}
                            {row.player_id === identity?.player_id && (
                              <small>Vous</small>
                            )}
                          </span>
                        </span>
                      </th>
                      <td className="leaderboard-xp">
                        {number.format(row.xp)}
                      </td>
                      <td>
                        {number.format(row.mastered)}
                        <small className="leaderboard-outof">
                          {" "}
                          / {number.format(row.item_count)}
                        </small>
                      </td>
                      <td>{precision(row.accuracy)}</td>
                      <td>{number.format(row.attempts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="leaderboard-pagination">
              <span>
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, result.total)} sur{" "}
                {number.format(result.total)}
              </span>
              <div>
                <button
                  aria-label="Page précédente"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ArrowLeft size={17} />
                </button>
                <span>
                  Page {page + 1} / {Math.ceil(result.total / PAGE_SIZE)}
                </span>
                <button
                  aria-label="Page suivante"
                  disabled={(page + 1) * PAGE_SIZE >= result.total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="leaderboard-empty">
            <Search size={30} />
            <h3>
              {search || theme || game
                ? "Aucun joueur trouvé."
                : "Les premiers pas commencent ici."}
            </h3>
            <p>
              {search || theme || game
                ? "Essayez un autre pseudo ou élargissez les filtres."
                : "Les progrès des comptes connectés apparaîtront ici."}
            </p>
            {(search || theme || game) && (
              <button className="button-secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>
      <p className="leaderboard-footnote">
        Un compte, une place : seul le profil avec le plus de XP est retenu. Les
        filtres affichent ses résultats dans les jeux choisis. Les acquis sont
        comptés séparément pour chaque jeu ; la précision mesure les bonnes
        réponses depuis le début.
      </p>
    </section>
  );
}
