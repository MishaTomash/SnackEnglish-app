export type CategoryId = "vocabulary" | "tests" | "listening" | "speaking";
export type Accent = "amber" | "emerald" | "sky" | "rose";

export interface WordCardData {
  id: string;
  word: string;
  translation: string;
  transcription: string;
}

export interface QuizData {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface ListeningData {
  id: string;
  phrase: string;
  options: string[];
  correctAnswer: string;
}

export interface SpeakData {
  id: string;
  phrase: string;
  translation: string;
}

export type LessonStep =
  | { kind: "learn"; cards: WordCardData[] }
  | { kind: "quiz"; items: QuizData[] }
  | { kind: "listening"; items: ListeningData[] }
  | { kind: "speak"; items: SpeakData[] };

export interface LessonUnit {
  id: string;
  title: string;
  description: string;
  emoji: string;
  steps: LessonStep[];
}

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
  emoji: string;
  accent: Accent;
  units: LessonUnit[];
}
