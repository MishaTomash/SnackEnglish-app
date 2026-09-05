import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnglishLevel } from "../entities/word/types";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
  };
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface UserState {
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak: number;
  wordsLearnedCount: number;
  isLoading: boolean;
  error: string | null;
  hasLoadedProfile: boolean;
  lastActiveUnitId: string | null; // Додано поле для збереження прогресу

  setLevel: (level: EnglishLevel) => void;
  incrementStreak: () => void;
  incrementWordsLearned: (count?: number) => void;
  setLastActiveUnitId: (id: string | null) => void; // Сеттер

  updateLevel: (level: EnglishLevel) => Promise<boolean>;
  fetchUser: (force?: boolean) => Promise<void>;
  completeOnboarding: (level: EnglishLevel) => Promise<boolean>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      level: null,
      onboardingCompleted: false,
      streak: 1,
      wordsLearnedCount: 0,
      isLoading: false,
      error: null,
      hasLoadedProfile: false,
      lastActiveUnitId: null,

      setLevel: (level) => set({ level }),
      incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
      incrementWordsLearned: (count = 1) =>
        set((state) => ({
          wordsLearnedCount: state.wordsLearnedCount + count,
        })),
      setLastActiveUnitId: (id) => set({ lastActiveUnitId: id }),

      updateLevel: async (level: EnglishLevel) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/user/level`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ level }),
          });

          if (!res.ok) throw new Error("Помилка оновлення рівня");

          set({ level, isLoading: false, lastActiveUnitId: null }); // Скидаємо прогрес при зміні рівня
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      fetchUser: async (force = false) => {
        if (get().hasLoadedProfile && !force) return;

        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/user/me`, {
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error("Failed to fetch user");
          const data = await res.json();

          set({
            level: data.level,
            onboardingCompleted: data.onboardingCompleted,
            streak: data.streak,
            hasLoadedProfile: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      completeOnboarding: async (level: EnglishLevel) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/user/onboarding`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ level }),
          });

          if (!res.ok) throw new Error("Помилка збереження. Спробуй ще раз.");

          set({ level, onboardingCompleted: true, isLoading: false });
          return true;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },
    }),
    {
      name: "snack_user_storage",
      partialize: (state) => ({
        level: state.level,
        onboardingCompleted: state.onboardingCompleted,
        streak: state.streak,
        wordsLearnedCount: state.wordsLearnedCount,
        lastActiveUnitId: state.lastActiveUnitId, // Додано до збереження
      }),
    },
  ),
);
