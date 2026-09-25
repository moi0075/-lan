import { countries } from "../data/catalog";
import type { LearningItem } from "../engine/learning";
import type { GameMode, Profile } from "../engine/storage";

export interface LearningGame {
  id: string;
  title: string;
  description: string;
  skill: string;
  mode: GameMode;
  items: readonly LearningItem[];
}
export interface LearningTopic {
  id: string;
  title: string;
  description: string;
  art?: "globe" | "book";
  games: readonly LearningGame[];
}
export interface LearningTheme {
  id: string;
  title: string;
  description: string;
  art?: "globe" | "book";
  topics: readonly LearningTopic[];
}

/** The menu is driven by this catalogue, independently of its presentation. */
export const learningThemes: readonly LearningTheme[] = [
  {
    id: "geography",
    title: "Géographie",
    art: "globe",
    description:
      "Donnez des repères à votre curiosité. Des lieux à découvrir, des liens à retenir.",
    topics: [
      {
        id: "world",
        title: "Le monde",
        art: "globe",
        description:
          "197 pays, deux façons de les connaître. Choisissez la compétence que vous voulez travailler.",
        games: [
          {
            id: "world-place",
            title: "Placer les pays",
            description:
              "Un nom apparaît. Retrouvez le pays en cliquant sur la carte.",
            skill: "Se repérer sur la carte",
            mode: "place",
            items: countries,
          },
          {
            id: "world-name",
            title: "Nommer les pays",
            description:
              "Un pays est surligné. Retrouvez son nom et écrivez votre réponse.",
            skill: "Retrouver le nom",
            mode: "name",
            items: countries,
          },
        ],
      },
    ],
  },
];

export const allGames = learningThemes.flatMap((theme) =>
  theme.topics.flatMap((topic) => topic.games),
);

/** Compatibility adapter: browsing never initializes or modifies a saved track. */
export function learningForGame(profile: Profile, game: LearningGame) {
  return game.mode === "place" ? profile.learning : profile.naming?.learning;
}
