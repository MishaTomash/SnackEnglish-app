// 📁 Файл: SnackEnglish-app/backend/src/services/settingsService.ts
import { AppSettings } from "../models/AppSettings.js";

/**
 * Налаштування застосунку (ліміт уроків, денна ціль, підтримка, оплата).
 * Читаються з бази з кешем на 30 с — зміна в адмінці діє майже одразу,
 * а звичайні запити юзерів не ходять у базу щоразу.
 */

export interface AppSettingsData {
    paymentsEnabled: boolean;
    dailyLessonLimit: number;
    dailyGoalLessons: number;
    dailyGoalBonus: number;
    supportEnabled: boolean;
    supportUrl: string;
    supportTitle: string;
    supportText: string;
    supportGiveawayText: string;
    referralBonus: number;
    botWelcomeImage: string;
    ttsEnabled: boolean;
    ttsModel: string;
    ttsVoice: string;
    ttsVoiceSnacky: string;
    ttsVoiceUser: string;
    ttsVoiceNpc: string;
    ttsSpeed: number;
    ttsInstructions: string;
    ttsAutoGenerate: boolean;
    ttsMonthlyLimitUsd: number;
    ttsPlaybackRate: number;
}

/** Моделі й голоси OpenAI TTS */
export const TTS_MODELS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"] as const;
export const TTS_VOICES = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
] as const;
/** Ці голоси є лише в gpt-4o-mini-tts */
export const TTS_MINI_ONLY_VOICES: readonly string[] = ["ballad", "verse"];

export const DEFAULT_TTS_INSTRUCTIONS =
    "Speak naturally and warmly with a neutral American accent, at a normal native conversational speed. Do not slow down or over-enunciate. Lively, natural intonation."

export const DEFAULT_SETTINGS: AppSettingsData = {
    paymentsEnabled: false,
    dailyLessonLimit: 5,
    dailyGoalLessons: 3,
    dailyGoalBonus: 5,
    supportEnabled: false,
    supportUrl: "",
    supportTitle: "Підтримай Снекі 🍪",
    supportText:
        "SnackEnglish безкоштовний, і ми хочемо, щоб так і лишалось. Якщо тобі подобається — підтримай проєкт донатом на банку. Будь-яка сума допомагає 💛",
    supportGiveawayText: "Призи для щотижневого розіграшу — з ваших донатів. Дякуємо всім, хто підтримує 💛",
    referralBonus: 20,
    botWelcomeImage: "",
    ttsEnabled: false,
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "coral",
    // Снекі — бадьорий, юзер — чоловічий голос, персонаж уроку — інший тембр
    ttsVoiceSnacky: "nova",
    ttsVoiceUser: "ash",
    ttsVoiceNpc: "sage",
    ttsSpeed: 0.95,
    ttsInstructions: DEFAULT_TTS_INSTRUCTIONS,
    ttsAutoGenerate: true,
    ttsMonthlyLimitUsd: 5,
    // mini-tts говорить неквапливо — трохи пришвидшуємо відтворення (тембр не змінюється)
    ttsPlaybackRate: 1.1,
};

const CACHE_TTL_MS = 30 * 1000;
const SETTINGS_KEY = "global";

let cache: { data: AppSettingsData; expiresAt: number } | null = null;

type SettingsRow = Partial<AppSettingsData>;

/** Поточні налаштування (порожні поля з бази замінюються значеннями за замовчуванням) */
export const getAppSettings = async (): Promise<AppSettingsData> => {
    if (cache && cache.expiresAt > Date.now()) return cache.data;

    const row = await AppSettings.findOne({ key: SETTINGS_KEY }).lean<SettingsRow>();
    const data: AppSettingsData = {
        paymentsEnabled: row?.paymentsEnabled ?? DEFAULT_SETTINGS.paymentsEnabled,
        dailyLessonLimit: row?.dailyLessonLimit ?? DEFAULT_SETTINGS.dailyLessonLimit,
        dailyGoalLessons: row?.dailyGoalLessons ?? DEFAULT_SETTINGS.dailyGoalLessons,
        dailyGoalBonus: row?.dailyGoalBonus ?? DEFAULT_SETTINGS.dailyGoalBonus,
        supportEnabled: row?.supportEnabled ?? DEFAULT_SETTINGS.supportEnabled,
        supportUrl: row?.supportUrl || DEFAULT_SETTINGS.supportUrl,
        supportTitle: row?.supportTitle || DEFAULT_SETTINGS.supportTitle,
        supportText: row?.supportText || DEFAULT_SETTINGS.supportText,
        supportGiveawayText: row?.supportGiveawayText || DEFAULT_SETTINGS.supportGiveawayText,
        referralBonus: row?.referralBonus ?? DEFAULT_SETTINGS.referralBonus,
        botWelcomeImage: row?.botWelcomeImage ?? DEFAULT_SETTINGS.botWelcomeImage,
        ttsEnabled: row?.ttsEnabled ?? DEFAULT_SETTINGS.ttsEnabled,
        ttsModel: row?.ttsModel || DEFAULT_SETTINGS.ttsModel,
        ttsVoice: row?.ttsVoice || DEFAULT_SETTINGS.ttsVoice,
        ttsVoiceSnacky: row?.ttsVoiceSnacky ?? DEFAULT_SETTINGS.ttsVoiceSnacky,
        ttsVoiceUser: row?.ttsVoiceUser ?? DEFAULT_SETTINGS.ttsVoiceUser,
        ttsVoiceNpc: row?.ttsVoiceNpc ?? DEFAULT_SETTINGS.ttsVoiceNpc,
        ttsSpeed: row?.ttsSpeed ?? DEFAULT_SETTINGS.ttsSpeed,
        ttsInstructions: row?.ttsInstructions || DEFAULT_SETTINGS.ttsInstructions,
        ttsAutoGenerate: row?.ttsAutoGenerate ?? DEFAULT_SETTINGS.ttsAutoGenerate,
        ttsMonthlyLimitUsd: row?.ttsMonthlyLimitUsd ?? DEFAULT_SETTINGS.ttsMonthlyLimitUsd,
        ttsPlaybackRate: row?.ttsPlaybackRate ?? DEFAULT_SETTINGS.ttsPlaybackRate,
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
};

const isHttpsUrl = (value: string): boolean => /^https:\/\/[^\s]+$/i.test(value);

const readInt = (value: unknown, min: number, max: number): number | null => {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

const readText = (value: unknown, maxLength: number): string | null =>
    typeof value === "string" && value.trim().length <= maxLength ? value.trim() : null;

export type SettingsUpdateResult = { ok: true; data: AppSettingsData } | { ok: false; error: string };

/** Оновлює налаштування з адмінки; кожне поле перевіряється окремо */
export const updateAppSettings = async (input: unknown): Promise<SettingsUpdateResult> => {
    if (typeof input !== "object" || input === null) return { ok: false, error: "Порожній запит" };
    const body = input as Record<string, unknown>;
    const patch: Partial<AppSettingsData> = {};

    if (body.paymentsEnabled !== undefined) {
        if (typeof body.paymentsEnabled !== "boolean") return { ok: false, error: "paymentsEnabled: true/false" };
        patch.paymentsEnabled = body.paymentsEnabled;
    }
    if (body.dailyLessonLimit !== undefined) {
        const value = readInt(body.dailyLessonLimit, 0, 100);
        if (value === null) return { ok: false, error: "Ліміт уроків — від 0 до 100 (0 — без ліміту)" };
        patch.dailyLessonLimit = value;
    }
    if (body.dailyGoalLessons !== undefined) {
        const value = readInt(body.dailyGoalLessons, 0, 100);
        if (value === null) return { ok: false, error: "Денна ціль — від 0 до 100 (0 — без цілі)" };
        patch.dailyGoalLessons = value;
    }
    if (body.dailyGoalBonus !== undefined) {
        const value = readInt(body.dailyGoalBonus, 0, 1000);
        if (value === null) return { ok: false, error: "Бонус — від 0 до 1000 кубків" };
        patch.dailyGoalBonus = value;
    }
    if (body.referralBonus !== undefined) {
        const value = readInt(body.referralBonus, 0, 1000);
        if (value === null) return { ok: false, error: "Бонус за друга — від 0 до 1000 кубків (0 — вимкнено)" };
        patch.referralBonus = value;
    }
    if (body.botWelcomeImage !== undefined) {
        const value = readText(body.botWelcomeImage, 500);
        if (value === null || (value !== "" && !isHttpsUrl(value))) {
            return { ok: false, error: "Картинка привітання — посилання, що починається з https://" };
        }
        patch.botWelcomeImage = value;
    }
    if (body.ttsEnabled !== undefined) {
        if (typeof body.ttsEnabled !== "boolean") return { ok: false, error: "ttsEnabled: true/false" };
        patch.ttsEnabled = body.ttsEnabled;
    }
    if (body.ttsAutoGenerate !== undefined) {
        if (typeof body.ttsAutoGenerate !== "boolean") return { ok: false, error: "ttsAutoGenerate: true/false" };
        patch.ttsAutoGenerate = body.ttsAutoGenerate;
    }
    if (body.ttsModel !== undefined) {
        if (typeof body.ttsModel !== "string" || !(TTS_MODELS as readonly string[]).includes(body.ttsModel)) {
            return { ok: false, error: "Невідома модель озвучки" };
        }
        patch.ttsModel = body.ttsModel;
    }
    if (body.ttsVoice !== undefined) {
        if (typeof body.ttsVoice !== "string" || !(TTS_VOICES as readonly string[]).includes(body.ttsVoice)) {
            return { ok: false, error: "Невідомий голос" };
        }
        patch.ttsVoice = body.ttsVoice;
    }
    for (const field of ["ttsVoiceSnacky", "ttsVoiceUser", "ttsVoiceNpc"] as const) {
        const value = body[field];
        if (value === undefined) continue;
        // Порожньо — той самий голос, що й основний
        if (typeof value !== "string" || (value !== "" && !(TTS_VOICES as readonly string[]).includes(value))) {
            return { ok: false, error: "Невідомий голос персонажа" };
        }
        patch[field] = value;
    }
    if (body.ttsSpeed !== undefined) {
        const speed = Number(body.ttsSpeed);
        if (!Number.isFinite(speed) || speed < 0.5 || speed > 1.5) return { ok: false, error: "Швидкість — від 0.5 до 1.5" };
        patch.ttsSpeed = Math.round(speed * 100) / 100;
    }
    if (body.ttsInstructions !== undefined) {
        const value = readText(body.ttsInstructions, 600);
        if (value === null) return { ok: false, error: "Інструкція для голосу — до 600 символів" };
        patch.ttsInstructions = value;
    }
    if (body.ttsPlaybackRate !== undefined) {
        const rate = Number(body.ttsPlaybackRate);
        if (!Number.isFinite(rate) || rate < 0.8 || rate > 1.5) return { ok: false, error: "Швидкість відтворення — від 0.8 до 1.5" };
        patch.ttsPlaybackRate = Math.round(rate * 100) / 100;
    }
    if (body.ttsMonthlyLimitUsd !== undefined) {
        const limit = Number(body.ttsMonthlyLimitUsd);
        if (!Number.isFinite(limit) || limit < 0 || limit > 500) return { ok: false, error: "Ліміт витрат — від 0 до 500 $" };
        patch.ttsMonthlyLimitUsd = Math.round(limit * 100) / 100;
    }
    if (body.supportUrl !== undefined) {
        const value = readText(body.supportUrl, 500);
        if (value === null || (value !== "" && !isHttpsUrl(value))) {
            return { ok: false, error: "Посилання на банку має починатися з https://" };
        }
        patch.supportUrl = value;
    }
    if (body.supportTitle !== undefined) {
        const value = readText(body.supportTitle, 80);
        if (value === null) return { ok: false, error: "Заголовок — до 80 символів" };
        patch.supportTitle = value;
    }
    if (body.supportText !== undefined) {
        const value = readText(body.supportText, 500);
        if (value === null) return { ok: false, error: "Текст — до 500 символів" };
        patch.supportText = value;
    }
    if (body.supportGiveawayText !== undefined) {
        const value = readText(body.supportGiveawayText, 300);
        if (value === null) return { ok: false, error: "Текст для розіграшу — до 300 символів" };
        patch.supportGiveawayText = value;
    }
    if (body.supportEnabled !== undefined) {
        if (typeof body.supportEnabled !== "boolean") return { ok: false, error: "supportEnabled: true/false" };
        patch.supportEnabled = body.supportEnabled;
    }

    // Увімкнути підтримку без посилання не можна — кнопка вела б у нікуди
    const current = await getAppSettings();

    // Голоси ballad / verse є лише в gpt-4o-mini-tts
    const nextModel = patch.ttsModel ?? current.ttsModel;
    const nextVoice = patch.ttsVoice ?? current.ttsVoice;
    const roleVoices = [
        nextVoice,
        patch.ttsVoiceSnacky ?? current.ttsVoiceSnacky,
        patch.ttsVoiceUser ?? current.ttsVoiceUser,
        patch.ttsVoiceNpc ?? current.ttsVoiceNpc,
    ];
    const miniOnly = roleVoices.find((voice) => voice && TTS_MINI_ONLY_VOICES.includes(voice));
    if (nextModel !== "gpt-4o-mini-tts" && miniOnly) {
        return { ok: false, error: `Голос «${miniOnly}» є лише в моделі gpt-4o-mini-tts` };
    }
    const nextUrl = patch.supportUrl ?? current.supportUrl;
    const nextEnabled = patch.supportEnabled ?? current.supportEnabled;
    if (nextEnabled && !nextUrl) return { ok: false, error: "Спершу вкажи посилання на банку" };

    // Ціль більша за ліміт недосяжна — попереджаємо одразу
    const nextLimit = patch.dailyLessonLimit ?? current.dailyLessonLimit;
    const nextGoal = patch.dailyGoalLessons ?? current.dailyGoalLessons;
    if (nextLimit > 0 && nextGoal > nextLimit) {
        return { ok: false, error: "Денна ціль не може бути більшою за ліміт уроків" };
    }

    await AppSettings.updateOne({ key: SETTINGS_KEY }, { $set: patch }, { upsert: true });
    cache = null;
    return { ok: true, data: await getAppSettings() };
};

/** Що бачить застосунок (без службових полів) */
export const toPublicConfig = (s: AppSettingsData) => ({
    paymentsEnabled: s.paymentsEnabled,
    support:
        s.supportEnabled && s.supportUrl
            ? { url: s.supportUrl, title: s.supportTitle, text: s.supportText, giveawayText: s.supportGiveawayText }
            : null,
    lessons: { dailyLimit: s.dailyLessonLimit, dailyGoal: s.dailyGoalLessons, goalBonus: s.dailyGoalBonus },
    referralBonus: s.referralBonus,
    ttsPlaybackRate: s.ttsPlaybackRate,
});

// ==================== ДЕННИЙ ПРОГРЕС ====================

/** Початок сьогоднішнього дня за часом сервера (TZ задано в index.ts — Київ) */
export const startOfToday = (): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const nextMidnight = (): Date => {
    const d = startOfToday();
    d.setDate(d.getDate() + 1);
    return d;
};

export interface DailyProgress {
    /** Стрік після уроку (лише у відповіді на завершення) */
    streak?: number;
    /** Серію врятовано "шансом" після пропущеного дня */
    streakRestored?: boolean;
    completedToday: number;
    limit: number;
    goal: number;
    goalReached: boolean;
    limitReached: boolean;
    resetsAt: string;
    /** Лише у відповіді на завершення уроку: бонус, якщо ціль виконано саме зараз */
    bonusXp?: number;
}

export const buildDailyProgress = (completedToday: number, s: AppSettingsData, bonusXp?: number): DailyProgress => ({
    completedToday,
    limit: s.dailyLessonLimit,
    goal: s.dailyGoalLessons,
    goalReached: s.dailyGoalLessons > 0 && completedToday >= s.dailyGoalLessons,
    limitReached: s.dailyLessonLimit > 0 && completedToday >= s.dailyLessonLimit,
    resetsAt: nextMidnight().toISOString(),
    ...(bonusXp !== undefined ? { bonusXp } : {}),
});