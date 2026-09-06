import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel, Word } from "./types";

export async function getWordsByIds(ids: string[]): Promise<Word[]> {
  if (!ids || ids.length === 0) return [];

  try {
    const response = await apiClient.post<Word[]>("/words/batch", { ids });
    return (response.data as any).words || response.data || [];
  } catch (error) {
    console.error("Error fetching words in batch:", error);
    throw error; // Тепер батьківський компонент дізнається про помилку
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
  /**
   * Реальна кількість унікальних вивчених слів користувача, порахована
   * на бекенді (UserProgress, repetitions >= LEARNED_MIN_REPETITIONS).
   * Приходить одразу в цій відповіді, щоб не робити окремий forced
   * fetchUser() після кожної картки в Практиці.
   */
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
