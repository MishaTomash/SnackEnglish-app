import type { EnglishLevel } from "../word/types";

export type UnitStepType =
  | "warmup"
  | "vocabulary"
  | "grammar"
  | "video"
  | "reading"
  | "speaking"
  | "roleplay"
  | "test";

export type StepStatus = "locked" | "available" | "completed";

export interface UnitStep {
  id: string;
  type: UnitStepType;
  status: StepStatus;
}

export interface RoleplayDialogueItem {
  speaker: "bot" | "user";
  text: string;
  options?: string[];
  hint?: string;
}

export interface RoleplayScenario {
  context: string;
  dialogue: RoleplayDialogueItem[];
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
  steps: UnitStep[];
  status?: StepStatus;
  completedSteps?: UnitStepType[];
  roleplayScenario?: RoleplayScenario;
}
