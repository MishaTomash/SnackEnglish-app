import { create } from "zustand";
import type { Word } from "../entities/word/types";
import { getPracticeWordsApi, reviewWordApi } from "../entities/word/api";

type RequestStatus = "idle" | "loading" | "success" | "error";

interface RepetitionState {
  dailyQueue: Word[];
  currentWordIndex: number;
  status: RequestStatus;
  error: string | null;
  isFinished: boolean;
  loadDailyWords: () => Promise<void>;
  submitReview: (quality: number) => Promise<void>;
  resetQueue: () => void;
}

export const useRepetitionStore = create<RepetitionState>((set, get) => ({
  dailyQueue: [],
  currentWordIndex: 0,
  status: "idle",
  error: null,
  isFinished: false,

  loadDailyWords: async () => {
    set({
      status: "loading",
      error: null,
      isFinished: false,
      currentWordIndex: 0,
    });
    try {
      const data = await getPracticeWordsApi();
      set({
        dailyQueue: data.words,
        status: "success",
        isFinished: data.words.length === 0,
      });
    } catch (err: unknown) {
      console.error("Помилка завантаження слів на повторення:", err);
      set({
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Не вдалося завантажити слова. Перевірте з'єднання.",
        dailyQueue: [],
      });
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
      // Тут можна додати toast-сповіщення, але ми не блокуємо UI
    }
  },

  resetQueue: () => {
    set({
      currentWordIndex: 0,
      isFinished: false,
      status: "idle",
      error: null,
    });
  },
}));
