import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoryId, Category } from "../entities/learning/types";
import { useUserStore } from "./userStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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

export const dateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayKey = (): string => dateKey(new Date());

export const computeStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (set.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

interface UnitProgress {
  completed: boolean;
  completedAt: number;
  bestAccuracy: number;
}

interface LearningState {
  categories: Category[];
  noMoreDays: boolean;
  currentPlanId: string | null;
  currentDayTitle: string | null;
  isLoading: boolean;

  progress: Record<string, UnitProgress>;

  dailyDate: string;
  dailyCompletedCategories: CategoryId[];
  celebratedDayKey: string | null;
  goalCompletedDates: string[];

  fetchCategories: (level: string) => Promise<void>;
  markUnitCompleted: (
    unitId: string,
    categoryId: CategoryId,
    accuracy: number,
    wordIds: string[],
  ) => Promise<void>;
  markCelebrated: () => void;
  recordGoalReached: () => Promise<void>;
  resetAll: () => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      categories: [],
      noMoreDays: false,
      currentPlanId: null,
      currentDayTitle: null,
      isLoading: false,
      progress: {},
      dailyDate: todayKey(),
      dailyCompletedCategories: [],
      celebratedDayKey: null,
      goalCompletedDates: [],

      fetchCategories: async (level: string) => {
        set({ isLoading: true });
        try {
          const res = await fetch(
            `${API_URL}/progress/categories?level=${level}`,
            { headers: getAuthHeaders() },
          );
          if (res.ok) {
            const data = await res.json();
            set({
              categories: data.categories || [],
              noMoreDays: data.noMoreDays || false,
              currentPlanId: data.planId || null,
              currentDayTitle: data.dayTitle || null,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error("Failed to fetch categories:", error);
          set({ isLoading: false });
        }
      },

      markUnitCompleted: async (unitId, categoryId, accuracy, wordIds) => {
        const state = get();
        const today = todayKey();
        const dailyCats =
          state.dailyDate === today ? state.dailyCompletedCategories : [];
        const newDaily = dailyCats.includes(categoryId)
          ? dailyCats
          : [...dailyCats, categoryId];
        const existing = state.progress[unitId];

        set({
          progress: {
            ...state.progress,
            [unitId]: {
              completed: true,
              completedAt: Date.now(),
              bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
            },
          },
          dailyDate: today,
          dailyCompletedCategories: newDaily,
        });

        try {
          const res = await fetch(`${API_URL}/progress/lesson-complete`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ unitId, wordIds }), // Додано wordIds
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.totalScore !== undefined) {
              useUserStore.setState({ totalScore: data.totalScore });
            }
          }
        } catch (e) {
          console.error("Failed to sync lesson progress", e);
        }
      },

      markCelebrated: () => set({ celebratedDayKey: todayKey() }),

      recordGoalReached: async () => {
        const state = get();
        const key = todayKey();

        if (!state.goalCompletedDates.includes(key)) {
          set({ goalCompletedDates: [...state.goalCompletedDates, key] });
        }

        if (state.currentPlanId) {
          try {
            await fetch(`${API_URL}/progress/categories/complete-day`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({ planId: state.currentPlanId }),
            });
          } catch (error) {
            console.error("Failed to complete day", error);
          }
        }
      },

      resetAll: () =>
        set({
          progress: {},
          dailyDate: todayKey(),
          dailyCompletedCategories: [],
          celebratedDayKey: null,
          goalCompletedDates: [],
        }),
    }),
    {
      name: "snack_learning_storage",
      partialize: (state) => ({
        progress: state.progress,
        dailyDate: state.dailyDate,
        dailyCompletedCategories: state.dailyCompletedCategories,
        celebratedDayKey: state.celebratedDayKey,
        goalCompletedDates: state.goalCompletedDates,
      }),
    },
  ),
);
