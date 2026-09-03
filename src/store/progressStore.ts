import { create } from "zustand";
import type { EnglishLevel } from "../entities/word/types";
import type { Unit, UnitStepType } from "../entities/unit/types";
import { getUnits, completeUnitStepApi } from "../entities/unit/api";

interface ProgressState {
  units: Unit[];
  currentUnitId: string | null;
  isLoading: boolean;
  error: string | null;
  loadUnits: (level?: EnglishLevel) => Promise<void>;
  completeStep: (unitId: string, stepType: UnitStepType) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  units: [],
  currentUnitId: null,
  isLoading: false,
  error: null,

  loadUnits: async (level?: EnglishLevel) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getUnits(level);
      const activeUnit = data.find((u) => u.status === "available") ?? data[0];
      set({
        units: data,
        currentUnitId: activeUnit ? activeUnit.id : null,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({
        error:
          err instanceof Error ? err.message : "Не вдалося завантажити юніти",
        isLoading: false,
      });
    }
  },

  completeStep: async (unitId: string, stepType: UnitStepType) => {
    try {
      await completeUnitStepApi(unitId, stepType);
      // Перезавантажуємо актуальний стан юнітів з бази даних після оновлення кроку
      await get().loadUnits();
    } catch (err: unknown) {
      console.error("Помилка фіксації кроку юніту:", err);
    }
  },
}));
