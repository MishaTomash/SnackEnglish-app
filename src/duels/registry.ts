import React, { lazy } from "react";
import type { DuelConfig, DuelGameProps } from "./types";

const SpeedClashGame = lazy(() =>
  import("./speed-clash/SpeedClashGame").then((m) => ({
    default: m.SpeedClashGame,
  })),
);

const TugOfWarGame = lazy(() =>
  import("./tug-of-war/TugOfWarGame").then((m) => ({
    default: m.TugOfWarGame,
  })),
);

const HotPotatoGame = lazy(() =>
  import("./hot-potato/HotPotatoGame").then((m) => ({
    default: m.HotPotatoGame,
  })),
);

export interface DuelRegistryEntry extends DuelConfig {
  component: React.ComponentType<DuelGameProps> | null;
}

export const DUEL_REGISTRY: DuelRegistryEntry[] = [
  {
    id: "speed-clash",
    title: "Мовна Битва",
    description: "Хто швидше обере правильний переклад? Доведи свою швидкість!",
    status: "available",
    component: SpeedClashGame as any,
  },
  {
    id: "tug-of-war",
    title: "Перетягування Канату",
    description:
      "Хто першим напише переклад? Правильні літери тягнуть канат, помилки - штрафують!",
    status: "available",
    component: TugOfWarGame as any,
  },
  {
    id: "hot-potato",
    title: "Гаряча Картопля",
    description:
      "Бомба ось-ось вибухне! Відповідай правильно, щоб перекинути її супернику.",
    status: "available",
    component: HotPotatoGame as any,
  },
];
