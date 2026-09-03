import { apiClient } from "../../shared/api/apiClient";
import { mockWords } from "../../mocks/words";
import type { EnglishLevel, Word } from "./types";

const isMockMode = import.meta.env.VITE_USE_MOCKS === "true";

export async function getWordsByIds(ids: string[]): Promise<Word[]> {
  if (isMockMode) {
    const idSet = new Set(ids);
    return mockWords.filter((w) => idSet.has(w.id));
  }

  return apiClient.post<Word[]>("/words/batch", { ids });
}

export async function getWordsByLevel(level: EnglishLevel): Promise<Word[]> {
  if (isMockMode) {
    return mockWords.filter((w) => w.level === level);
  }

  return apiClient.get<Word[]>(`/words?level=${encodeURIComponent(level)}`);
}

export async function getWordById(id: string): Promise<Word | null> {
  if (isMockMode) {
    return mockWords.find((w) => w.id === id) ?? null;
  }

  return apiClient.get<Word>(`/words/${encodeURIComponent(id)}`);
}
