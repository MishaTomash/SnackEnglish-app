import { create } from "zustand";
import type { EnglishLevel } from "../entities/word/types";
import type { Unit, UnitStepType } from "../entities/unit/types";
import { getUnits, completeUnitStepApi } from "../entities/unit/api";
import { useUserStore } from "./userStore";

interface ProgressState {
  units: Unit[];
  currentUnitId: string | null;
  progressPercent: number;
  completedStepsCount: number;
  totalStepsCount: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedLevel: EnglishLevel | null;

  loadUnits: (level?: EnglishLevel, force?: boolean) => Promise<void>;
  completeStep: (unitId: string, stepType: UnitStepType) => Promise<void>;
  setCurrentUnitId: (unitId: string) => void;
}

// Допоміжна функція для динамічного підрахунку кількості кроків у юніті
const getUnitTotalSteps = (unit: any): number => {
  if (unit.steps && unit.steps.length > 0) return unit.steps.length;

  let count = 1; // warmup
  if (unit.wordIds?.length > 0) count += 2; // vocabulary + speaking
  if (
    (unit.grammarTopic && unit.grammarExplanation) ||
    (unit.grammar?.title && unit.grammar?.explanation)
  )
    count += 1;
  if (unit.videoUrl) count += 1;
  if (unit.readingText) count += 1;
  count += 1; // test

  return count;
};

export const useProgressStore = create<ProgressState>((set, get) => ({
  units: [],
  currentUnitId: null,
  progressPercent: 0,
  completedStepsCount: 0,
  totalStepsCount: 0,
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

      let globalCompletedSteps = 0;
      let globalTotalSteps = 0;

      const normalizedUnits: Unit[] = (rawData || []).map((raw: any) => {
        const completedSteps = raw.completedSteps || [];
        const totalSteps = getUnitTotalSteps(raw);

        globalCompletedSteps += completedSteps.length;
        globalTotalSteps += totalSteps;

        return {
          ...raw,
          id: raw.id || raw._id,
          status: raw.status || "locked",
          completedSteps,
        };
      });

      const progressPercent =
        globalTotalSteps > 0
          ? Math.round((globalCompletedSteps / globalTotalSteps) * 100)
          : 0;

      // Визначаємо активний юніт
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
        completedStepsCount: globalCompletedSteps,
        totalStepsCount: globalTotalSteps,
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
      // force=true змушує стор завантажити свіжі дані з бекенду і перерахувати відсоток
      await get().loadUnits(get().lastFetchedLevel || "A1", true);
    } catch (err: unknown) {
      console.error("Помилка фіксації кроку:", err);
    }
  },
}));
