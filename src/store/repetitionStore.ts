import { create } from "zustand";
import type { Word } from "../entities/word/types";
import { getPracticeWordsApi, reviewWordApi } from "../entities/word/api";
import { useUserStore } from "./userStore";
import { useLearningStore } from "./learningStore";

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
      const timeoutPromise = new Promise<{ dueWordIds: string[] }>(
        (_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Сервер не відповідає. Перевірте з'єднання.")),
            TIMEOUT_MS,
          ),
      );

      const data = await Promise.race([getPracticeWordsApi(), timeoutPromise]);
      const dueIds = data.dueWordIds || [];
      const wordsToReview: Word[] = [];

      if (dueIds.length > 0) {
        // ЗАХИСТ ВІД ПУСТОГО СТЕЙТУ: Якщо категорії ще не завантажені, вантажимо їх
        let { categories, fetchCategories } = useLearningStore.getState();
        if (categories.length === 0) {
          const { level } = useUserStore.getState();
          if (level) {
            await fetchCategories(level);
            categories = useLearningStore.getState().categories;
          }
        }

        // Тепер безпечно шукаємо текст слів
        const idSet = new Set(dueIds);
        for (const cat of categories) {
          for (const unit of cat.units) {
            for (const step of unit.steps) {
              if (step.kind === "learn") {
                for (const card of step.cards) {
                  if (idSet.has(card.id)) {
                    wordsToReview.push({
                      id: card.id,
                      text: card.word,
                      translation: card.translation,
                      transcription: card.transcription,
                      exampleSentence: "", // Заглушка (у Практиці не виводиться)
                      exampleTranslation: "", // Заглушка
                      level: "A1",
                      topic: cat.title,
                    });
                    idSet.delete(card.id);
                  }
                }
              }
            }
          }
        }
      }

      set({
        dailyQueue: wordsToReview,
        status: "success",
        isFinished: wordsToReview.length === 0,
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
