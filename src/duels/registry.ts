import React from "react";
import type { DuelConfig, DuelGameProps } from "./types";

export interface DuelRegistryEntry extends DuelConfig {
  component: React.ComponentType<DuelGameProps> | null;
}

// Реєстр дуельних ігор очищено.
// Додавайте нові дуельні ігри сюди.
export const DUEL_REGISTRY: DuelRegistryEntry[] = [];
