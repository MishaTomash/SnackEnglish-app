import type { Word } from "./types";
import { mockWords } from "../../mocks/words";

// Імітація затримки мережі
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getWordsByIds = async (ids: string[]): Promise<Word[]> => {
  await delay(300); // 300ms network latency mock
  return mockWords.filter((word) => ids.includes(word.id));
};
