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

export interface UserState {
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak: number;
  wordsLearnedCount: number;
  isLoading: boolean;
  error: string | null;
  hasLoadedProfile: boolean;
  lastActiveUnitId: string | null;

  telegramFirstName: string | null;
  telegramPhotoUrl: string | null;
  customDisplayName: string | null;
  customAvatarUrl: string | null;
  nickname: string | null;

  setLevel: (level: EnglishLevel) => void;
  incrementStreak: () => void;
  incrementWordsLearned: (count?: number) => void;
  setLastActiveUnitId: (id: string | null) => void;

  updateLevel: (level: EnglishLevel) => Promise<boolean>;
  fetchUser: (force?: boolean) => Promise<void>;
  completeOnboarding: (level: EnglishLevel) => Promise<boolean>;

  updateProfile: (
    displayName: string | null,
    avatarFile: File | null,
  ) => Promise<boolean>;
  updateNickname: (
    nickname: string,
  ) => Promise<{ success: boolean; error?: string }>;
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

      telegramFirstName: null,
      telegramPhotoUrl: null,
      customDisplayName: null,
      customAvatarUrl: null,
      nickname: null,

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
            level: data.level,
            onboardingCompleted: data.onboardingCompleted,
            streak: data.streak,
            telegramFirstName: data.telegramFirstName,
            telegramPhotoUrl: data.telegramPhotoUrl,
            customDisplayName: data.customDisplayName,
            customAvatarUrl: data.customAvatarUrl,
            nickname: data.nickname,
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

      updateNickname: async (nickname: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/user/nickname`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ nickname }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Помилка оновлення нікнейму");
          }
          set({ nickname, isLoading: false });
          return { success: true };
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message };
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
        lastActiveUnitId: state.lastActiveUnitId,
        telegramFirstName: state.telegramFirstName,
        telegramPhotoUrl: state.telegramPhotoUrl,
        customDisplayName: state.customDisplayName,
        customAvatarUrl: state.customAvatarUrl,
        nickname: state.nickname,
      }),
    },
  ),
);
