import { useEffect, useState } from "react";
import { learningThemes } from "./catalog/learningCatalog";

export type Page = "library" | "play" | "progress" | "game-progress" | "atlas";
export interface AppRoute {
  page: Page;
  themeId?: string;
  topicId?: string;
}

function readRoute(): AppRoute {
  const [page, themeId, topicId] = window.location.hash
    .replace(/^#\/?/, "")
    .split("/");
  if (
    page === "play" ||
    page === "progress" ||
    page === "game-progress" ||
    page === "atlas"
  )
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
  function go(next: AppRoute) {
    const path =
      next.page === "library"
        ? ["themes", next.themeId, next.topicId].filter(Boolean).join("/")
        : next.page;
    window.location.hash = `/${path}`;
    setRoute(next);
  }
  return { route, go };
}
