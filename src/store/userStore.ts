import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnglishLevel } from "../entities/word/types";

interface UserState {
  level: EnglishLevel | null;
  streak: number;
  wordsLearnedCount: number;
  setLevel: (level: EnglishLevel) => void;
  incrementStreak: () => void;
  incrementWordsLearned: (count?: number) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      level: null,
      streak: 1,
      wordsLearnedCount: 0,
      setLevel: (level) => set({ level }),
      incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
      incrementWordsLearned: (count = 1) =>
        set((state) => ({
          wordsLearnedCount: state.wordsLearnedCount + count,
        })),
    }),
    {
      name: "snack_user_storage",
    },
  ),
);
