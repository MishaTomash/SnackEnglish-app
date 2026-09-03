import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Unit, UnitStep, UnitStepType } from "../entities/unit/types";
import type { EnglishLevel } from "../entities/word/types";
import { getUnitsByLevel } from "../entities/unit/api";

export type UnitStatus = "locked" | "available" | "completed";

export interface UnitWithProgress extends Omit<Unit, "steps"> {
  status: UnitStatus;
  steps: UnitStep[];
}

const ALL_STEP_TYPES: UnitStepType[] = [
  "warmup",
  "vocabulary",
  "grammar",
  "video",
  "reading",
  "speaking",
  "test",
];

interface ProgressState {
  units: UnitWithProgress[];
  currentUnitId: string | null;
  isLoading: boolean;
  loadUnits: (level: EnglishLevel) => Promise<void>;
  completeUnit: (unitId: string) => void;
  unlockNextUnit: () => void;
  completeStep: (unitId: string, stepType: UnitStepType) => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      units: [],
      currentUnitId: null,
      isLoading: false,

      loadUnits: async (level: EnglishLevel) => {
        const existingUnits = get().units;
        if (existingUnits.length > 0) return;

        set({ isLoading: true });
        try {
          const fetchedUnits = await getUnitsByLevel(level);

          const initializedUnits: UnitWithProgress[] = fetchedUnits.map(
            (unit, unitIdx) => {
              const isUnitAvailable = unitIdx === 0;

              const fullSteps: UnitStep[] = ALL_STEP_TYPES.map(
                (type, stepIdx) => ({
                  id: `${unit.id}_${type}`,
                  type,
                  status:
                    isUnitAvailable && stepIdx === 0 ? "available" : "locked",
                }),
              );

              return {
                ...unit,
                status: isUnitAvailable ? "available" : "locked",
                steps: fullSteps,
              };
            },
          );

          set({
            units: initializedUnits,
            currentUnitId: initializedUnits[0]?.id ?? null,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to load units:", error);
          set({ isLoading: false });
        }
      },

      completeUnit: (unitId: string) => {
        set((state) => {
          const unitIndex = state.units.findIndex((u) => u.id === unitId);
          let nextId = state.currentUnitId;

          const updatedUnits = state.units.map((unit, idx) => {
            if (unit.id === unitId) {
              return { ...unit, status: "completed" as const };
            }
            if (idx === unitIndex + 1 && unit.status === "locked") {
              nextId = unit.id;
              return {
                ...unit,
                status: "available" as const,
                steps: unit.steps.map((s, sIdx) =>
                  sIdx === 0 ? { ...s, status: "available" as const } : s,
                ),
              };
            }
            return unit;
          });

          return {
            units: updatedUnits,
            currentUnitId: nextId,
          };
        });
      },

      unlockNextUnit: () => {
        set((state) => {
          const firstLockedIdx = state.units.findIndex(
            (u) => u.status === "locked",
          );
          if (firstLockedIdx === -1) return state;

          const updatedUnits = state.units.map((unit, idx) => {
            if (idx === firstLockedIdx) {
              return {
                ...unit,
                status: "available" as const,
                steps: unit.steps.map((s, sIdx) =>
                  sIdx === 0 ? { ...s, status: "available" as const } : s,
                ),
              };
            }
            return unit;
          });

          return {
            units: updatedUnits,
            currentUnitId: updatedUnits[firstLockedIdx].id,
          };
        });
      },

      completeStep: (unitId: string, stepType: UnitStepType) => {
        set((state) => {
          const unit = state.units.find((u) => u.id === unitId);
          if (!unit) return state;

          const stepIndex = unit.steps.findIndex((s) => s.type === stepType);
          if (stepIndex === -1) return state;

          const updatedSteps = unit.steps.map((step, idx) => {
            if (idx === stepIndex) {
              return { ...step, status: "completed" as const };
            }
            if (idx === stepIndex + 1 && step.status === "locked") {
              return { ...step, status: "available" as const };
            }
            return step;
          });

          const isLastStep = stepIndex === unit.steps.length - 1;

          const updatedUnits = state.units.map((u) => {
            if (u.id === unitId) {
              return {
                ...u,
                steps: updatedSteps,
                status: isLastStep ? ("completed" as const) : u.status,
              };
            }
            return u;
          });

          return {
            units: updatedUnits,
          };
        });

        // Якщо це був останній крок (test) — відкриваємо наступний юніт
        if (stepType === "test") {
          get().completeUnit(unitId);
          get().unlockNextUnit();
        }
      },
    }),
    {
      name: "snack_progress_storage",
    },
  ),
);
