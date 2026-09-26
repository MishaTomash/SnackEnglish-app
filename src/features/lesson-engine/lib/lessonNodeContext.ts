// 📁 Файл: SnackEnglish-app/src/features/lesson-engine/lib/lessonNodeContext.ts
import { createContext, useContext } from "react";

/** Дані уроку, потрібні крокам (напр., ім'я персонажа для реплік npc у діалозі) */
export interface LessonNodeInfo {
    npc: string;
    npcName: string;
}

export const LessonNodeContext = createContext<LessonNodeInfo>({ npc: "", npcName: "" });

export const useLessonNode = (): LessonNodeInfo => useContext(LessonNodeContext);