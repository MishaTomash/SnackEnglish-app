import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel, Word } from "./types";

export async function getWordsByIds(ids: string[]): Promise<Word[]> {
  const response = await apiClient.post<Word[]>("/words/batch", { ids });
  return response.data;
}

export async function getWordsByLevel(level: EnglishLevel): Promise<Word[]> {
  const response = await apiClient.get<Word[]>(
    `/words?level=${encodeURIComponent(level)}`,
  );
  return response.data;
}

export async function getWordById(id: string): Promise<Word | null> {
  const response = await apiClient.get<Word>(
    `/words/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function getPracticeWordsApi(): Promise<{
  count: number;
  words: Word[];
}> {
  const response = await apiClient.get<{ count: number; words: Word[] }>(
    "/progress/practice",
  );
  return response.data;
}

export async function reviewWordApi(
  wordId: string,
  quality: number,
): Promise<{
  success: boolean;
  repetitions: number;
  interval: number;
  nextReviewDate: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    repetitions: number;
    interval: number;
    nextReviewDate: string;
  }>("/progress/review", {
    wordId,
    quality,
  });
  return response.data;
}
