import type { Unit } from "./types";
import type { EnglishLevel } from "../word/types";
import { mockUnits } from "../../mocks/units";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getUnitsByLevel = async (level: EnglishLevel): Promise<Unit[]> => {
  await delay(400);
  return mockUnits
    .filter((unit) => unit.level === level)
    .sort((a, b) => a.order - b.order);
};

export const getUnitById = async (id: string): Promise<Unit | undefined> => {
  await delay(200);
  return mockUnits.find((unit) => unit.id === id);
};
