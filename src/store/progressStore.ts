import { create } from "zustand";
import type { EnglishLevel } from "../entities/word/types";
import type { Unit, UnitStepType } from "../entities/unit/types";
import { getUnits, completeUnitStepApi } from "../entities/unit/api";
import { useUserStore } from "./userStore";

interface ProgressState {
  units: Unit[];
  currentUnitId: string | null;
  progressPercent: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedLevel: EnglishLevel | null;

  loadUnits: (level?: EnglishLevel, force?: boolean) => Promise<void>;
  completeStep: (unitId: string, stepType: UnitStepType) => Promise<void>;
  setCurrentUnitId: (unitId: string) => void;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  units: [],
  currentUnitId: null,
  progressPercent: 0,
  isLoading: false,
  error: null,
  lastFetchedLevel: null,

  setCurrentUnitId: (unitId: string) => {
    set({ currentUnitId: unitId });
    useUserStore.getState().setLastActiveUnitId(unitId);
  },

  loadUnits: async (level: EnglishLevel = "A1", force = false) => {
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

      const completedCount = normalizedUnits.filter(
        (u) => u.status === "completed",
      ).length;
      const progressPercent =
        normalizedUnits.length > 0
          ? Math.round((completedCount / normalizedUnits.length) * 100)
          : 0;

      // Визначаємо активний юніт: пріоритет на збереженому ID, якщо він доступний
      const savedUnitId = useUserStore.getState().lastActiveUnitId;
      let activeUnit = normalizedUnits.find((u) => u.id === savedUnitId);

      if (!activeUnit || activeUnit.status === "locked") {
        activeUnit =
          normalizedUnits.find((u) => u.status === "available") ??
          normalizedUnits[0];

        if (activeUnit) {
          useUserStore.getState().setLastActiveUnitId(activeUnit.id);
        }
      }

      set({
        units: normalizedUnits,
        currentUnitId: activeUnit ? activeUnit.id : null,
        progressPercent,
        lastFetchedLevel: level,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({ error: "Не вдалося завантажити юніти", isLoading: false });
    }
  },

  completeStep: async (unitId: string, stepType: UnitStepType) => {
    try {
      await completeUnitStepApi(unitId, stepType);
      useUserStore.getState().setLastActiveUnitId(unitId);
      await get().loadUnits(get().lastFetchedLevel || "A1", true);
    } catch (err: unknown) {
      console.error("Помилка фіксації кроку:", err);
    }
  },
}));
