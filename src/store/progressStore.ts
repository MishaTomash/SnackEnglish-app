import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Unit } from "../entities/unit/types";
import type { EnglishLevel } from "../entities/word/types";
import { getUnitsByLevel } from "../entities/unit/api";

export type UnitStatus = "locked" | "available" | "completed";

export interface UnitWithProgress extends Unit {
  status: UnitStatus;
}

interface ProgressState {
  units: UnitWithProgress[];
  currentUnitId: string | null;
  isLoading: boolean;
  loadUnits: (level: EnglishLevel) => Promise<void>;
  completeUnit: (unitId: string) => void;
  unlockNextUnit: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      units: [],
      currentUnitId: null,
      isLoading: false,
      loadUnits: async (level: EnglishLevel) => {
        // Якщо дані вже є у локальному сховищі, не перезаписуємо їх заново
        const existingUnits = get().units;
        if (existingUnits.length > 0) {
          return;
        }

        set({ isLoading: true });
        try {
          const fetchedUnits = await getUnitsByLevel(level);
          const initializedUnits: UnitWithProgress[] = fetchedUnits.map(
            (unit, index) => ({
              ...unit,
              status: index === 0 ? "available" : "locked",
            }),
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
              return { ...unit, status: "available" as const };
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
              return { ...unit, status: "available" as const };
            }
            return unit;
          });

          return {
            units: updatedUnits,
            currentUnitId: updatedUnits[firstLockedIdx].id,
          };
        });
      },
    }),
    {
      name: "snack_progress_storage",
    },
  ),
);
