import type { GameConfig } from "./types";

export interface RegistryEntry extends GameConfig {
  component: React.ComponentType<any>;
}

// Реєстр одиночних ігор очищено.
// Додавайте нові ігри сюди.
export const GAME_REGISTRY: RegistryEntry[] = [];
