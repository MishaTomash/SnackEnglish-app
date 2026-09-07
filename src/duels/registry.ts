import React from "react";
import type { DuelConfig, DuelGameProps } from "./types";
import { WordClashGame } from "./word-clash/WordClashGame";

export interface DuelRegistryEntry extends DuelConfig {
  component: React.ComponentType<DuelGameProps> | null;
}

export const DUEL_REGISTRY: DuelRegistryEntry[] = [
  {
    id: "word-clash",
    title: "Битва Слів",
    description: "Хто швидше обере правильний переклад? Доведи свою швидкість!",
    status: "available",
    component: WordClashGame,
  },
];
