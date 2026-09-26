import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";
import type { EnglishLevel } from "../entities/word/types";
import { apiClient } from "../shared/api/apiClient";

/**
 * Запити йдуть через apiClient — як і в решті застосунку:
 * - та сама адреса API ("/api" за замовчуванням, а не http://localhost:3000, що не працює на телефоні);
 * - той самий initData (з Telegram або з URL; мок — лише в режимі розробки);
 * - заголовок для ngrok і таймаут уже налаштовані в apiClient.
 */

/** Повідомлення про помилку: текст із сервера, якщо він є, інакше запасний */
const toErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (typeof data === "object" && data !== null && "error" in data) {
      const message = (data as { error: unknown }).error;
      if (typeof message === "string" && message) return message;
    }
    return fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

/** Поля профілю, які віддає GET /user/me */
interface MeResponse {
  telegramId: number;
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak?: number;
  hp?: number;
  totalScore?: number;
  weeklyScore?: number;
  wordsLearnedCount?: number;
  telegramFirstName?: string | null;
  username?: string | null;
  telegramPhotoUrl?: string | null;
  customDisplayName?: string | null;
  customAvatarUrl?: string | null;
}

interface ProfileResponse {
  customDisplayName?: string | null;
  customAvatarUrl?: string | null;
  hp?: number;
}

export interface UserState {
  telegramId: number | null;
  level: EnglishLevel | null;
  onboardingCompleted: boolean;
  streak: number;
  hp: number; // Стейт життів
  totalScore: number;
  /** Кубки тижня — їх бачить юзер; щонеділі скидаються разом із рейтингом */
  weeklyScore: number;
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

// Один запит профілю на всіх: StrictMode і кілька компонентів можуть викликати fetchUser одночасно
let fetchUserRequest: Promise<void> | null = null;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      telegramId: null,
      level: null,
      onboardingCompleted: false,
      streak: 0,
      hp: 5,
      totalScore: 0,
      weeklyScore: 0,
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
          const formData = new FormData();
          formData.append("hp", newHp.toString());
          // Сервер лише зменшує hp ($min) і повертає актуальне значення
          const { data } = await apiClient.patch<ProfileResponse>("/user/profile", formData);
          if (typeof data.hp === "number") set({ hp: data.hp });
        } catch (e) {
          console.error("Failed to sync HP", e);
        }
      },

      updateLevel: async (level: EnglishLevel) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.patch("/user/level", { level });
          set({ level, isLoading: false, lastActiveUnitId: null });
          return true;
        } catch (error) {
          set({ error: toErrorMessage(error, "Помилка оновлення рівня"), isLoading: false });
          return false;
        }
      },

      fetchUser: async (force = false) => {
        if (get().hasLoadedProfile && !force) return;
        if (fetchUserRequest) return fetchUserRequest;

        fetchUserRequest = (async () => {
          set({ isLoading: true, error: null });
          try {
            const { data } = await apiClient.get<MeResponse>("/user/me");
            set({
              telegramId: data.telegramId,
              level: data.level,
              onboardingCompleted: data.onboardingCompleted,
              streak: data.streak ?? 0,
              hp: data.hp ?? 5, // Підтягуємо HP
              totalScore: data.totalScore ?? 0,
              weeklyScore: data.weeklyScore ?? 0,
              wordsLearnedCount: data.wordsLearnedCount ?? 0,
              telegramFirstName: data.telegramFirstName ?? null,
              telegramUsername: data.username ?? null,
              telegramPhotoUrl: data.telegramPhotoUrl ?? null,
              customDisplayName: data.customDisplayName ?? null,
              customAvatarUrl: data.customAvatarUrl ?? null,
              hasLoadedProfile: true,
              isLoading: false,
            });
          } catch (error) {
            set({ error: toErrorMessage(error, "Failed to fetch user"), isLoading: false });
          } finally {
            fetchUserRequest = null;
          }
        })();

        return fetchUserRequest;
      },

      completeOnboarding: async (level: EnglishLevel) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.patch("/user/onboarding", { level });
          set({ level, onboardingCompleted: true, isLoading: false });
          return true;
        } catch (error) {
          set({ error: toErrorMessage(error, "Помилка збереження. Спробуй ще раз."), isLoading: false });
          return false;
        }
      },

      updateProfile: async (displayName: string | null, avatarFile: File | null) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          if (displayName) formData.append("customDisplayName", displayName);
          if (avatarFile) formData.append("avatar", avatarFile);

          // apiClient сам прибирає Content-Type для FormData — браузер додасть boundary
          const { data } = await apiClient.patch<ProfileResponse>("/user/profile", formData, {
            timeout: 30000, // завантаження фото на повільному мобільному інтернеті
          });

          set({
            customDisplayName: data.customDisplayName ?? null,
            customAvatarUrl: data.customAvatarUrl ?? null,
            isLoading: false,
          });
          return true;
        } catch (error) {
          const message =
            axios.isAxiosError(error) && error.response?.status === 413
              ? "Фото завелике. Максимум 5 МБ."
              : axios.isAxiosError(error) && error.response?.status === 429
                ? "Забагато змін аватара. Спробуй трохи пізніше."
                : toErrorMessage(error, "Помилка оновлення профілю");
          set({ error: message, isLoading: false });
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
        weeklyScore: state.weeklyScore,
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