import { lazy } from "react";
import type { GameConfig } from "./types";

// Використовуємо lazy, щоб код ігор вантажився лише при їх запуску
const WordMatch = lazy(() =>
  import("./word-match").then((m) => ({ default: m.WordMatchGame })),
);
const Hangman = lazy(() =>
  import("./hangman").then((m) => ({ default: m.HangmanGame })),
);

export interface RegistryEntry extends GameConfig {
  component: React.ComponentType<any>;
}

export const GAME_REGISTRY: RegistryEntry[] = [
  {
    id: "word-match",
    title: "Слово-Пара",
    description: "З'єднай англійське слово з правильним перекладом на час.",
    isFree: true,
    status: "coming_soon",
    component: WordMatch,
  },
  {
    id: "hangman",
    title: "Врятуй Печиво",
    description: "Вгадуй слово по літерах. Кожна помилка — мінус крихта!",
    isFree: false,
    priceStars: 50,
    status: "coming_soon",
    component: Hangman,
  },
];
