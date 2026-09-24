import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel, Word } from "./types";

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
