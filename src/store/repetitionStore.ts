import { create } from "zustand";
import type { Word } from "../entities/word/types";
import { getPracticeWordsApi, reviewWordApi } from "../entities/word/api";

interface RepetitionState {
  dailyQueue: Word[];
  currentWordIndex: number;
  isLoading: boolean;
  isFinished: boolean;
  loadDailyWords: () => Promise<void>;
  submitReview: (quality: number) => Promise<void>;
  resetQueue: () => void;
}

export const useRepetitionStore = create<RepetitionState>((set, get) => ({
  dailyQueue: [],
  currentWordIndex: 0,
  isLoading: false,
  isFinished: false,

  loadDailyWords: async () => {
    set({ isLoading: true, isFinished: false, currentWordIndex: 0 });
    try {
      const data = await getPracticeWordsApi();
      set({
        dailyQueue: data.words,
        isLoading: false,
        isFinished: data.words.length === 0,
      });
    } catch (err: unknown) {
      console.error("Помилка завантаження слів на повторення:", err);
      set({ isLoading: false });
    }
  },

  submitReview: async (quality: number) => {
    const { dailyQueue, currentWordIndex } = get();
    const currentWord = dailyQueue[currentWordIndex];

    if (!currentWord) return;

    try {
      await reviewWordApi(currentWord.id, quality);

      const nextIndex = currentWordIndex + 1;
      if (nextIndex >= dailyQueue.length) {
        set({ isFinished: true, currentWordIndex: nextIndex });
      } else {
        set({ currentWordIndex: nextIndex });
      }
    } catch (err: unknown) {
      console.error("Помилка надсилання оцінки SM-2:", err);
    }
  },

  resetQueue: () => {
    set({ currentWordIndex: 0, isFinished: false });
  },
}));
