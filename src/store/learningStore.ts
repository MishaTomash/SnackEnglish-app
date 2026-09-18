import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoryId } from "../entities/learning/types";

export const DAILY_GOAL = 4;

export const dateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayKey = (): string => dateKey(new Date());

/** Скільки днів поспіль підряд (включно з сьогодні або вчора) було закрито ціль. */
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

export const XP_PER_STEP = 10;
export const XP_PER_CORRECT = 5;
export const REPEAT_XP_MULTIPLIER = 0.5;

interface UnitProgress {
  completed: boolean;
  completedAt: number;
  bestAccuracy: number;
}

interface LearningState {
  progress: Record<string, UnitProgress>;
  xp: number;

  dailyDate: string;
  dailyCompletedCategories: CategoryId[];

  /** YYYY-MM-DD — день, у якому ми вже показали оверлей "день завершено". */
  celebratedDayKey: string | null;

  /** YYYY-MM-DD — усі дні, коли ціль 4/4 була закрита. Для серії. */
  goalCompletedDates: string[];

  markUnitCompleted: (
    unitId: string,
    categoryId: CategoryId,
    accuracy: number,
    earnedXp: number,
  ) => void;
  markCelebrated: () => void;
  recordGoalReached: () => void;
  resetAll: () => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      progress: {},
      xp: 0,
      dailyDate: todayKey(),
      dailyCompletedCategories: [],
      celebratedDayKey: null,
      goalCompletedDates: [],

      markUnitCompleted: (unitId, categoryId, accuracy, earnedXp) =>
        set((state) => {
          const today = todayKey();
          const dailyCats =
            state.dailyDate === today ? state.dailyCompletedCategories : [];

          const existing = state.progress[unitId];
          const isFirstTime = !existing?.completed;
          const awarded = isFirstTime
            ? earnedXp
            : Math.round(earnedXp * REPEAT_XP_MULTIPLIER);

          const newDaily = dailyCats.includes(categoryId)
            ? dailyCats
            : [...dailyCats, categoryId];

          return {
            progress: {
              ...state.progress,
              [unitId]: {
                completed: true,
                completedAt: Date.now(),
                bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
              },
            },
            xp: state.xp + awarded,
            dailyDate: today,
            dailyCompletedCategories: newDaily,
          };
        }),

      markCelebrated: () => set({ celebratedDayKey: todayKey() }),

      recordGoalReached: () =>
        set((state) => {
          const key = todayKey();
          if (state.goalCompletedDates.includes(key)) return state;
          return {
            goalCompletedDates: [...state.goalCompletedDates, key],
          };
        }),

      resetAll: () =>
        set({
          progress: {},
          xp: 0,
          dailyDate: todayKey(),
          dailyCompletedCategories: [],
          celebratedDayKey: null,
          goalCompletedDates: [],
        }),
    }),
    { name: "snack_learning_storage" },
  ),
);
