// 📁 Файл: SnackEnglish-app/backend/src/models/AppSettings.ts
import { Schema, model, Document } from "mongoose";

/**
 * Налаштування застосунку, які адмін змінює в панелі без перезапуску сервера.
 * У базі один документ з key = "global".
 */
export interface IAppSettings extends Document {
    key: string;
    /** Оплата ігор (Зірки / карта). Вимкнено — усі ігри безкоштовні */
    paymentsEnabled: boolean;
    /** Скільки НОВИХ уроків на день можна пройти; 0 — без ліміту */
    dailyLessonLimit: number;
    /** Денна ціль (уроків); 0 — без цілі */
    dailyGoalLessons: number;
    /** Бонусні кубки за виконання денної цілі */
    dailyGoalBonus: number;
    /** Блок "Підтримати" (банка Monobank) */
    supportEnabled: boolean;
    supportUrl: string;
    supportTitle: string;
    supportText: string;
    /** Текст у вкладці "Розіграш" */
    supportGiveawayText: string;
    /** Бонус обом за запрошеного друга (після його першого уроку); 0 — вимкнено */
    referralBonus: number;
    /** Картинка до привітання новачка в боті (https://…); порожньо — лише текст */
    botWelcomeImage: string;

    // ---------- Озвучка (OpenAI TTS) ----------
    /** Уроки грають згенероване аудіо замість голосу телефона */
    ttsEnabled: boolean;
    ttsModel: string;
    ttsVoice: string;
    /** Голоси персонажів; порожньо — як основний (ttsVoice) */
    ttsVoiceSnacky: string;
    ttsVoiceUser: string;
    ttsVoiceNpc: string;
    /** Швидкість (лише tts-1 / tts-1-hd; для gpt-4o-mini-tts — через інструкцію) */
    ttsSpeed: number;
    /** Як говорити (лише gpt-4o-mini-tts) */
    ttsInstructions: string;
    /** Швидкість відтворення озвучки в уроках (без переозвучки): 1 — як записано */
    ttsPlaybackRate: number;
    /** Автоматично озвучувати нові фрази (кожні 30 хв удень) */
    ttsAutoGenerate: boolean;
    /** Ліміт витрат на озвучку за календарний місяць, $ */
    ttsMonthlyLimitUsd: number;
}

const appSettingsSchema = new Schema<IAppSettings>(
    {
        key: { type: String, required: true, unique: true, default: "global" },
        paymentsEnabled: { type: Boolean, default: false },
        dailyLessonLimit: { type: Number, default: 5, min: 0, max: 100 },
        dailyGoalLessons: { type: Number, default: 3, min: 0, max: 100 },
        dailyGoalBonus: { type: Number, default: 5, min: 0, max: 1000 },
        supportEnabled: { type: Boolean, default: false },
        supportUrl: { type: String, default: "" },
        supportTitle: { type: String, default: "" },
        supportText: { type: String, default: "" },
        supportGiveawayText: { type: String, default: "" },
        referralBonus: { type: Number, default: 20, min: 0, max: 1000 },
        botWelcomeImage: { type: String, default: "" },

        ttsEnabled: { type: Boolean, default: false },
        ttsModel: { type: String, default: "gpt-4o-mini-tts" },
        ttsVoice: { type: String, default: "coral" },
        ttsVoiceSnacky: { type: String, default: "" },
        ttsVoiceUser: { type: String, default: "" },
        ttsVoiceNpc: { type: String, default: "" },
        ttsSpeed: { type: Number, default: 0.95 },
        ttsInstructions: { type: String, default: "" },
        ttsAutoGenerate: { type: Boolean, default: true },
        ttsPlaybackRate: { type: Number, default: 1.1 },
        ttsMonthlyLimitUsd: { type: Number, default: 5 },
    },
    { timestamps: true },
);

export const AppSettings = model<IAppSettings>("AppSettings", appSettingsSchema);