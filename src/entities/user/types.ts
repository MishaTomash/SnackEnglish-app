import type { EnglishLevel } from "../word/types";

export interface UserProgress {
  level: EnglishLevel;
  currentUnitId: string;
  completedUnitIds: string[];
  streak: number;
  wordsLearnedCount: number;
}
