import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnglishLevel } from "../entities/word/types";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
    "ngrok-skip-browser-warning": "true",
    "Bypass-Tunnel-Reminder": "true",
  };
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface UserState {
  telegramId: number | null;
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak: number;
  hp: number; // ДОДАНО: Стейт життів
  totalScore: number;
  wordsLearnedCount: number;
  isLoading: boolean;
  error: string | null;
  hasLoadedProfile: boolean;
  lastActiveUnitId: string | null;

  telegramFirstName: string | null;
  telegramUsername: string | null;
  telegramPhotoUrl: string | null;
  customDisplayName: string | null;
  customAvatarUrl: string | null;

  setLevel: (level: EnglishLevel) => void;
  setLastActiveUnitId: (id: string | null) => void;
  decrementHp: () => Promise<void>; // Метод для зняття життя при помилці

  updateLevel: (level: EnglishLevel) => Promise<boolean>;
  fetchUser: (force?: boolean) => Promise<void>;
  completeOnboarding: (level: EnglishLevel) => Promise<boolean>;
  updateProfile: (
    displayName: string | null,
    avatarFile: File | null,
  ) => Promise<boolean>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      telegramId: null,
      level: null,
      onboardingCompleted: false,
      streak: 0,
      hp: 5,
      totalScore: 0,
      wordsLearnedCount: 0,
      isLoading: false,
      error: null,
      hasLoadedProfile: false,
      lastActiveUnitId: null,

      telegramFirstName: null,
      telegramUsername: null,
      telegramPhotoUrl: null,
      customDisplayName: null,
      customAvatarUrl: null,

      setLevel: (level) => set({ level }),
      setLastActiveUnitId: (id) => set({ lastActiveUnitId: id }),

      decrementHp: async () => {
        const currentHp = get().hp;
        if (currentHp <= 0) return;
        const newHp = currentHp - 1;

        set({ hp: newHp }); // Оптимістичне оновлення UI

        try {
          const initData =
            window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
          const formData = new FormData();
          formData.append("hp", newHp.toString());

          await fetch(`${API_URL}/user/profile`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${initData}` },
            body: formData,
          });
        } catch (e) {
          console.error("Failed to sync HP", e);
        }
      },

      updateLevel: async (level: EnglishLevel) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/user/level`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ level }),
          });
          if (!res.ok) throw new Error("Помилка оновлення рівня");
          set({ level, isLoading: false, lastActiveUnitId: null });
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
            telegramId: data.telegramId,
            level: data.level,
            onboardingCompleted: data.onboardingCompleted,
            streak: data.streak ?? 0,
            hp: data.hp ?? 5, // Підтягуємо HP
            totalScore: data.totalScore ?? 0,
            wordsLearnedCount: data.wordsLearnedCount ?? 0,
            telegramFirstName: data.telegramFirstName,
            telegramUsername: data.username ?? null,
            telegramPhotoUrl: data.telegramPhotoUrl,
            customDisplayName: data.customDisplayName,
            customAvatarUrl: data.customAvatarUrl,
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

      updateProfile: async (
        displayName: string | null,
        avatarFile: File | null,
      ) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          if (displayName) formData.append("customDisplayName", displayName);
          if (avatarFile) formData.append("avatar", avatarFile);

          const initData =
            window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
          const res = await fetch(`${API_URL}/user/profile`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${initData}` },
            body: formData,
          });

          if (!res.ok) throw new Error("Помилка оновлення профілю");
          const data = await res.json();
          set({
            customDisplayName: data.customDisplayName,
            customAvatarUrl: data.customAvatarUrl,
            isLoading: false,
          });
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
        telegramId: state.telegramId,
        level: state.level,
        onboardingCompleted: state.onboardingCompleted,
        streak: state.streak,
        hp: state.hp,
        totalScore: state.totalScore,
        wordsLearnedCount: state.wordsLearnedCount,
        lastActiveUnitId: state.lastActiveUnitId,
        telegramFirstName: state.telegramFirstName,
        telegramUsername: state.telegramUsername,
        telegramPhotoUrl: state.telegramPhotoUrl,
        customDisplayName: state.customDisplayName,
        customAvatarUrl: state.customAvatarUrl,
      }),
    },
  ),
);
