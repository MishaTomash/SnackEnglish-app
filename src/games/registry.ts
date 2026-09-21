import { lazy } from "react";
import type { GameConfig } from "./types";

const WordDrop = lazy(() =>
  import("./word-drop/WordDropGame").then((m) => ({ default: m.WordDropGame })),
);

const MemoryMatch = lazy(() =>
  import("./memory-match/MemoryMatchGame").then((m) => ({
    default: m.MemoryMatchGame,
  })),
);

const WordBuilder = lazy(() =>
  import("./word-builder/WordBuilderGame").then((m) => ({
    default: m.WordBuilderGame,
  })),
);

export interface RegistryEntry extends GameConfig {
  component: React.ComponentType<any>;
}

// Реєстр одиночних ігор.
export const GAME_REGISTRY: RegistryEntry[] = [
  {
    id: "word-drop",
    title: "Метеоритний Дощ",
    description:
      "Рятуй планету від слів-метеоритів! Встигни обрати правильний переклад, поки вони не впали.",
    isFree: true,
    status: "available",
    component: WordDrop,
  },
  {
    id: "memory-match",
    title: "Матриця Пам'яті",
    description:
      "Знайди пари англійських слів та їхніх перекладів, поки не вийшов час!",
    isFree: true,
    status: "available",
    component: MemoryMatch,
  },
  {
    id: "word-builder",
    title: "Будівельник Слів",
    description:
      "Склади англійське слово з перемішаних літер, орієнтуючись на переклад!",
    isFree: true,
    status: "available",
    component: WordBuilder,
  },
];
