import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel } from "../word/types";
import type { Unit, UnitStepType } from "./types";

export async function getUnits(level?: EnglishLevel): Promise<Unit[]> {
  // /progress/units рахує персональний статус (available/locked/completed),
  // мерджачи юніти з UserUnitProgress користувача — на відміну від старого
  // "/progress", який віддавав сирі Unit-документи без статусу (звідси й був
  // баг "всі юніти locked"). Бекенд тепер сам фільтрує по level.
  const query = level ? `?level=${encodeURIComponent(level)}` : "";
  const response = await apiClient.get<{
    units: Unit[];
    streak: number;
    level: string;
  }>(`/progress/units${query}`);

  return response.data.units || [];
}

export async function getUnitById(unitId: string): Promise<Unit | null> {
  const response = await apiClient.get<{ units: Unit[] }>("/progress/units");
  const found = (response.data.units || []).find(
    (u) => u.id === unitId || (u as any)._id === unitId,
  );
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
