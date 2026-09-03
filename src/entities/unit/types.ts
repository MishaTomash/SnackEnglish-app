import type { EnglishLevel } from "../word/types";

export type UnitStepType =
  | "warmup"
  | "vocabulary"
  | "grammar"
  | "video"
  | "reading"
  | "speaking"
  | "test";
export type UnitStepStatus = "locked" | "available" | "completed";

export interface UnitStep {
  id: string;
  type: UnitStepType;
  status: UnitStepStatus;
}

export interface Unit {
  id: string;
  title: string;
  level: EnglishLevel;
  topic: string;
  order: number;
  wordIds: string[];
  grammarTopic: string;
  grammarExplanation: string;
  videoUrl: string;
  readingText: string;
  readingTranslation: string;
  steps: UnitStep[]; // Додано для збереження структури кроків юніта
}
