import { apiClient } from "../../shared/api/apiClient";
import { mockUnits } from "../../mocks/units";
import type { EnglishLevel } from "../word/types";
import type { Unit, UnitStepType } from "./types";

const isMockMode = import.meta.env.VITE_USE_MOCKS === "true";

export async function getUnits(level?: EnglishLevel): Promise<Unit[]> {
  if (isMockMode) {
    if (!level) return mockUnits;
    return mockUnits.filter((u) => u.level === level);
  }

  const query = level ? `?level=${encodeURIComponent(level)}` : "";
  return apiClient.get<Unit[]>(`/units${query}`);
}

export async function getUnitById(unitId: string): Promise<Unit | null> {
  if (isMockMode) {
    return mockUnits.find((u) => u.id === unitId) ?? null;
  }

  return apiClient.get<Unit>(`/units/${encodeURIComponent(unitId)}`);
}

export async function completeUnitStepApi(
  unitId: string,
  stepType: UnitStepType,
): Promise<{ success: boolean }> {
  if (isMockMode) {
    return { success: true };
  }

  return apiClient.post<{ success: boolean }>(
    `/units/${encodeURIComponent(unitId)}/steps/${encodeURIComponent(stepType)}/complete`,
  );
}
