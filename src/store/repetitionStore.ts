import { create } from "zustand";
import { getPracticeWordsApi, reviewWordApi } from "../entities/word/api";
import { useUserStore } from "./userStore";
import type { PracticeItem } from "../entities/learning/types";

type RequestStatus = "idle" | "loading" | "success" | "error";

interface RepetitionState {
  dailyQueue: PracticeItem[];
  currentWordIndex: number;
  status: RequestStatus;
  error: string | null;
  isFinished: boolean;
  loadDailyWords: () => Promise<void>;
  submitReview: (quality: number) => Promise<void>;
  resetQueue: () => void;
}

const TIMEOUT_MS = 8000;

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
      const timeoutPromise = new Promise<{ dueItems: PracticeItem[] }>(
        (_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Сервер не відповідає. Перевірте з'єднання.")),
            TIMEOUT_MS,
          ),
      );

      const data = await Promise.race([getPracticeWordsApi(), timeoutPromise]);
      const itemsToReview = data.dueItems || [];

      set({
        dailyQueue: itemsToReview,
        status: "success",
        isFinished: itemsToReview.length === 0,
      });
    } catch (err: unknown) {
      console.error("❌ Помилка завантаження матеріалів на повторення:", err);
      set({
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Не вдалося завантажити матеріали. Спробуйте ще раз.",
        dailyQueue: [],
      });
    }
  },

  submitReview: async (quality: number) => {
    const { dailyQueue, currentWordIndex } = get();
    const currentItem = dailyQueue[currentWordIndex];

    if (!currentItem) return;

    try {
      const response = await reviewWordApi(currentItem.id, quality);

      if (typeof response.wordsLearnedCount === "number") {
        useUserStore.setState({
          wordsLearnedCount: response.wordsLearnedCount,
        });
      }

      const nextIndex = currentWordIndex + 1;
      if (nextIndex >= dailyQueue.length) {
        set({ isFinished: true, currentWordIndex: nextIndex });
      } else {
        set({ currentWordIndex: nextIndex });
      }
    } catch (err: unknown) {
      console.error("❌ Помилка надсилання оцінки SM-2:", err);
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
