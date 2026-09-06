import { create } from "zustand";
import type { Word } from "../entities/word/types";
import { getPracticeWordsApi, reviewWordApi } from "../entities/word/api";
import { useUserStore } from "./userStore";

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
      // Реалізація таймауту на фронтенді
      const timeoutPromise = new Promise<{ words: Word[] }>((_, reject) =>
        setTimeout(
          () => reject(new Error("Сервер не відповідає. Перевірте з'єднання.")),
          TIMEOUT_MS,
        ),
      );

      // Запит перерветься з помилкою, якщо getPracticeWordsApi триватиме довше 8 секунд
      const data = await Promise.race([getPracticeWordsApi(), timeoutPromise]);

      set({
        dailyQueue: data.words,
        status: "success",
        // Якщо бекенд повернув порожній масив — це норма (isFinished = true)
        isFinished: data.words.length === 0,
      });
    } catch (err: unknown) {
      console.error("❌ Помилка завантаження слів на повторення:", err);
      set({
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Не вдалося завантажити слова. Спробуйте ще раз.",
        dailyQueue: [],
      });
    }
  },

  submitReview: async (quality: number) => {
    const { dailyQueue, currentWordIndex } = get();
    const currentWord = dailyQueue[currentWordIndex];

    if (!currentWord) return;

    try {
      const response = await reviewWordApi(currentWord.id, quality);

      // Джерело правди — бекенд: пишемо прийшле число напряму в userStore,
      // без окремого forced fetchUser() і без локального інкременту.
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
