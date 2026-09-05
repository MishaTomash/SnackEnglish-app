import { create } from "zustand";
import type { EnglishLevel } from "../entities/word/types";
import type { Unit, UnitStepType } from "../entities/unit/types";
import { getUnits, completeUnitStepApi } from "../entities/unit/api";

interface ProgressState {
  units: Unit[];
  currentUnitId: string | null;
  progressPercent: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedLevel: EnglishLevel | null; // Для кешування

  loadUnits: (level?: EnglishLevel, force?: boolean) => Promise<void>;
  completeStep: (unitId: string, stepType: UnitStepType) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  units: [],
  currentUnitId: null,
  progressPercent: 0,
  isLoading: false,
  error: null,
  lastFetchedLevel: null,

  loadUnits: async (level: EnglishLevel = "A1", force = false) => {
    // Кеш-хіт: якщо ми вже завантажили цей рівень, пропускаємо мережевий запит
    if (!force && get().lastFetchedLevel === level && get().units.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const rawData = await getUnits(level);

      const normalizedUnits: Unit[] = (rawData || []).map((raw: any) => ({
        ...raw,
        id: raw.id || raw._id,
        status: raw.status || "locked",
        completedSteps: raw.completedSteps || [],
      }));

      const activeUnit =
        normalizedUnits.find((u) => u.status === "available") ??
        normalizedUnits[0];

      // Рахуємо загальний прогрес курсу (пройдено / всього)
      const completedCount = normalizedUnits.filter(
        (u) => u.status === "completed",
      ).length;
      const progressPercent =
        normalizedUnits.length > 0
          ? Math.round((completedCount / normalizedUnits.length) * 100)
          : 0;

      set({
        units: normalizedUnits,
        currentUnitId: activeUnit ? activeUnit.id : null,
        progressPercent,
        lastFetchedLevel: level, // Зберігаємо індикатор кешу
        isLoading: false,
      });
    } catch (err: unknown) {
      set({ error: "Не вдалося завантажити юніти", isLoading: false });
    }
  },

  completeStep: async (unitId: string, stepType: UnitStepType) => {
    try {
      await completeUnitStepApi(unitId, stepType);

      // Інвалідація кешу: примусово перезавантажуємо юніти з бекенду (force = true)
      await get().loadUnits(get().lastFetchedLevel || "A1", true);
    } catch (err: unknown) {
      console.error("Помилка фіксації кроку:", err);
    }
  },
}));
