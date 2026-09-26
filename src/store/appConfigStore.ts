// 📁 Файл: SnackEnglish-app/src/store/appConfigStore.ts
import { create } from "zustand";
import { apiClient } from "../shared/api/apiClient";

/**
 * Налаштування застосунку з сервера (адмін змінює їх у панелі):
 * чи увімкнена оплата, блок "Підтримати" (банка), денний ліміт і ціль уроків.
 */

export interface SupportConfig {
    url: string;
    title: string;
    text: string;
    giveawayText: string;
}

export interface LessonsConfig {
    /** Нових уроків на день; 0 — без ліміту */
    dailyLimit: number;
    /** Денна ціль; 0 — без цілі */
    dailyGoal: number;
    goalBonus: number;
}

export interface AppConfig {
    paymentsEnabled: boolean;
    /** null — підтримку вимкнено */
    support: SupportConfig | null;
    lessons: LessonsConfig;
    /** Швидкість відтворення озвучки в уроках (1 — як записано) */
    ttsPlaybackRate: number;
}

interface AppConfigState {
    config: AppConfig | null;
    /** Завантажує один раз за сесію; force — перечитати (напр., після змін в адмінці) */
    load: (force?: boolean) => Promise<void>;
}

let request: Promise<void> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Відповідь сервера перевіряється, а не приймається "на віру" */
const parseConfig = (data: unknown): AppConfig | null => {
    if (!isRecord(data) || !isRecord(data.lessons)) return null;
    const support = isRecord(data.support) && typeof data.support.url === "string" ? data.support : null;
    return {
        paymentsEnabled: data.paymentsEnabled === true,
        support: support
            ? {
                url: String(support.url),
                title: String(support.title ?? ""),
                text: String(support.text ?? ""),
                giveawayText: String(support.giveawayText ?? ""),
            }
            : null,
        lessons: {
            dailyLimit: Number(data.lessons.dailyLimit) || 0,
            dailyGoal: Number(data.lessons.dailyGoal) || 0,
            goalBonus: Number(data.lessons.goalBonus) || 0,
        },
        ttsPlaybackRate: Number(data.ttsPlaybackRate) || 1,
    };
};

export const useAppConfigStore = create<AppConfigState>()((set, get) => ({
    config: null,
    load: async (force = false) => {
        if (get().config && !force) return;
        if (request) return request;
        request = apiClient
            .get<unknown>("/user/app-config")
            .then(({ data }) => {
                const config = parseConfig(data);
                if (config) set({ config });
            })
            .catch((error: unknown) => {
                // Без конфігу застосунок працює як раніше: блоку підтримки просто не видно
                console.error("[appConfig] Failed to load", error);
            })
            .finally(() => {
                request = null;
            });
        return request;
    },
}));