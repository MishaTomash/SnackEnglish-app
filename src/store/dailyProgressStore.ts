// 📁 Файл: SnackEnglish-app/src/store/dailyProgressStore.ts
import { create } from "zustand";
import { apiClient } from "../shared/api/apiClient";

/** Прогрес дня: скільки нових уроків пройдено, ліміт, денна ціль */
export interface DailyProgress {
    completedToday: number;
    /** 0 — без ліміту */
    limit: number;
    /** 0 — без цілі */
    goal: number;
    goalReached: boolean;
    limitReached: boolean;
    resetsAt: string;
    /** Лише одразу після уроку: бонус за щойно виконану денну ціль */
    bonusXp?: number;
    /** Лише одразу після уроку: стрік і чи врятовано його "шансом" */
    streak?: number;
    streakRestored?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Перевіряє відповідь сервера (з /stories/daily, з завершення уроку або з помилки ліміту) */
export const parseDailyProgress = (value: unknown): DailyProgress | null => {
    if (!isRecord(value) || typeof value.completedToday !== "number") return null;
    return {
        completedToday: value.completedToday,
        limit: Number(value.limit) || 0,
        goal: Number(value.goal) || 0,
        goalReached: value.goalReached === true,
        limitReached: value.limitReached === true,
        resetsAt: typeof value.resetsAt === "string" ? value.resetsAt : "",
        bonusXp: typeof value.bonusXp === "number" ? value.bonusXp : undefined,
        streak: typeof value.streak === "number" ? value.streak : undefined,
        streakRestored: value.streakRestored === true,
    };
};

interface DailyProgressState {
    daily: DailyProgress | null;
    fetchDaily: () => Promise<void>;
    setDaily: (daily: DailyProgress) => void;
}

export const useDailyProgressStore = create<DailyProgressState>()((set) => ({
    daily: null,
    fetchDaily: async () => {
        try {
            const { data } = await apiClient.get<unknown>("/stories/daily");
            const daily = parseDailyProgress(data);
            if (daily) set({ daily });
        } catch (error) {
            console.error("[daily] Failed to load", error);
        }
    },
    setDaily: (daily) => set({ daily }),
}));