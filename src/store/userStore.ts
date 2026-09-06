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
  telegramId: number | null;
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak: number;
  /**
   * Загальний рахунок (бали за пройдені кроки/юніти). Джерело правди —
   * бекенд (User.totalScore, рахується в progressController.completeStep).
   * Так само як wordsLearnedCount — тільки перезаписується з fetchUser(),
   * ніколи не інкрементується локально.
   */
  totalScore: number;
  /**
   * Кількість УНІКАЛЬНИХ вивчених слів. Джерело правди — бекенд
   * (COUNT(DISTINCT wordId) зі статусом "learned" у прогресі користувача).
   * Це поле НІКОЛИ не інкрементується локально — тільки перезаписується
   * значенням з відповіді сервера в fetchUser(). Кешується в localStorage
   * лише для миттєвого відображення до завершення першого fetchUser().
   */
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
      telegramId: null,
      level: null,
      onboardingCompleted: false,
      streak: 1,
      totalScore: 0,
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
            telegramId: data.telegramId,
            level: data.level,
            onboardingCompleted: data.onboardingCompleted,
            streak: data.streak,
            totalScore: data.totalScore ?? 0,
            // ВИПРАВЛЕНО: раніше це поле взагалі не синхронізувалось з
            // бекендом, тому показане число було виключно сумою локальних
            // incrementWordsLearned() викликів і ніколи не звірялось з реальністю.
            wordsLearnedCount: data.wordsLearnedCount ?? 0,
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
        telegramId: state.telegramId,
        level: state.level,
        onboardingCompleted: state.onboardingCompleted,
        streak: state.streak,
        totalScore: state.totalScore,
        // Кешуємо ОСТАННЄ ВІДОМЕ серверне значення для миттєвого відображення
        // до першого fetchUser() у новій сесії — не для накопичення локально.
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
