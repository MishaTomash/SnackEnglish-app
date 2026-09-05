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
  loadUnits: (level?: EnglishLevel) => Promise<void>;
  completeStep: (unitId: string, stepType: UnitStepType) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  units: [],
  currentUnitId: null,
  progressPercent: 0,
  isLoading: false,
  error: null,

  loadUnits: async (level: EnglishLevel = "A1") => {
    set({ isLoading: true, error: null });
    try {
      const rawData = await getUnits(level);

      const normalizedUnits: Unit[] = (rawData || []).map((raw: any) => ({
        ...raw,
        id: raw.id || raw._id,
        status: raw.status || "locked", // Жорстко довіряємо бекенду
        completedSteps: raw.completedSteps || [], // ДОДАНО: зберігаємо пройдені кроки
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
        isLoading: false,
      });
    } catch (err: unknown) {
      set({ error: "Не вдалося завантажити юніти", isLoading: false });
    }
  },

  completeStep: async (unitId: string, stepType: UnitStepType) => {
    try {
      await completeUnitStepApi(unitId, stepType);
      await get().loadUnits(); // Перезавантажить статуси з бази (відкриє наступний юніт)
    } catch (err: unknown) {
      console.error("Помилка фіксації кроку:", err);
    }
  },
}));
