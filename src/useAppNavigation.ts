import { useEffect, useState } from "react";
import { allGames, learningThemes } from "./catalog/learningCatalog";

export type Page =
  "library" | "play" | "progress" | "game-progress" | "atlas" | "leaderboard";
export interface AppRoute {
  page: Page;
  themeId?: string;
  topicId?: string;
  gameId?: string;
}

function readRoute(): AppRoute {
  const [page, themeId, topicId] = window.location.hash
    .replace(/^#\/?/, "")
    .split("/");
  if (page === "play" || page === "game-progress") {
    const game = allGames.find((item) => item.id === themeId);
    if (themeId && !game) return { page: "library" };
    return { page, gameId: game?.id };
  }
  if (page === "progress" || page === "atlas" || page === "leaderboard")
    return { page };
  const theme = learningThemes.find((item) => item.id === themeId);
  const topic = theme?.topics.find((item) => item.id === topicId);
  return { page: "library", themeId: theme?.id, topicId: topic?.id };
}

export function useAppNavigation() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  function go(next: AppRoute, replace = false) {
    const path =
      next.page === "library"
        ? ["themes", next.themeId, next.topicId].filter(Boolean).join("/")
        : [next.page, next.gameId].filter(Boolean).join("/");
    if (replace) window.history.replaceState(null, "", `#/${path}`);
    else window.location.hash = `/${path}`;
    setRoute(next);
  }
  return { route, go };
}
