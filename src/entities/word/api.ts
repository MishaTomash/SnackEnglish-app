import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel, Word } from "./types";
import type { PracticeItem } from "../learning/types";

export async function getWordsByIds(ids: string[]): Promise<Word[]> {
  if (!ids || ids.length === 0) return [];

  try {
    const response = await apiClient.post<Word[]>("/words/batch", { ids });
    return (response.data as any).words || response.data || [];
  } catch (error) {
    console.error("Error fetching words in batch:", error);
    throw error;
  }
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

// ВИПРАВЛЕНО: Тепер повертає масив PracticeItem
export async function getPracticeWordsApi(): Promise<{
  dueItems: PracticeItem[];
}> {
  const response = await apiClient.get<{ dueItems: PracticeItem[] }>(
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
  wordsLearnedCount: number;
}> {
  const response = await apiClient.post<{
    success: boolean;
    repetitions: number;
    interval: number;
    nextReviewDate: string;
    wordsLearnedCount: number;
  }>("/progress/review", {
    wordId,
    quality,
  });
  return response.data;
}
