import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel } from "../word/types";
import type { Unit, UnitStepType } from "./types";

export async function getUnits(level?: EnglishLevel): Promise<Unit[]> {
  const query = level ? `?level=${encodeURIComponent(level)}` : "";
  const response = await apiClient.get<Unit[]>(`/progress/units${query}`);
  return response.data;
}

export async function getUnitById(unitId: string): Promise<Unit | null> {
  const response = await apiClient.get<Unit[]>(`/progress/units`);
  const found = response.data.find((u) => u.id === unitId);
  return found ?? null;
}

export async function completeUnitStepApi(
  unitId: string,
  stepType: UnitStepType,
): Promise<{
  success: boolean;
  status: string;
  completedSteps: UnitStepType[];
}> {
  const response = await apiClient.post<{
    success: boolean;
    status: string;
    completedSteps: UnitStepType[];
  }>("/progress/step", {
    unitId,
    stepType,
  });
  return response.data;
}
