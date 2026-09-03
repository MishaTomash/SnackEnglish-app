export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface Word {
  id: string;
  text: string;
  translation: string;
  transcription: string;
  exampleSentence: string;
  exampleTranslation: string;
  level: EnglishLevel;
  topic: string;
}
