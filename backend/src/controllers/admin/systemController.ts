// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/systemController.ts
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { getSpeechMode } from "../../services/transcriptionService.js";
import { getBroadcastProgress } from "../../services/broadcastService.js";
import { invalidateLeaderboardCache } from "../leaderboardController.js";
import { clearDashboardCache } from "./dashboardController.js";
import { clearContentCache } from "./contentController.js";
import { getAdminTimezone, logAdminError, sendError } from "./adminHelpers.js";
import { CRON_SCHEDULE } from "../../services/cronService.js";

interface ConfigCheck {
    key: string;
    ok: boolean;
    level: "error" | "warning";
    hint: string;
}

const MONGO_STATES: Record<number, string> = {
    0: "відключено",
    1: "підключено",
    2: "підключення…",
    3: "відключення…",
};

const hasEnv = (name: string): boolean => Boolean(process.env[name]?.trim());

/** Перевірка .env: що не налаштовано або небезпечно на проді */
const checkConfig = (): ConfigCheck[] => {
    const isProduction = process.env.NODE_ENV === "production";
    const appUrl = process.env.VITE_APP_URL?.trim() ?? "";
    return [
        {
            key: "NODE_ENV",
            ok: isProduction,
            level: "warning",
            hint: isProduction ? "production" : "Не production — на сервері має бути NODE_ENV=production",
        },
        {
            // ВИПРАВЛЕНО: раніше вважалось нормою, якщо NODE_ENV не production. Але сервер,
            // доступний з інтернету (ngrok, хостинг), з тестовим входом відкритий для всіх.
            key: "ALLOW_DEV_AUTH",
            ok: process.env.ALLOW_DEV_AUTH !== "true",
            level: "error",
            hint:
                process.env.ALLOW_DEV_AUTH === "true"
                    ? "Увімкнено тестовий вхід: будь-хто може увійти під будь-яким акаунтом, зокрема адміна. Лише для локальної розробки без доступу з інтернету"
                    : "Вимкнено",
        },
        { key: "BOT_TOKEN", ok: hasEnv("BOT_TOKEN"), level: "error", hint: "Токен бота від @BotFather" },
        { key: "MONGODB_URI", ok: hasEnv("MONGODB_URI"), level: "error", hint: "Підключення до бази" },
        {
            key: "VITE_APP_URL",
            ok: appUrl.startsWith("https://"),
            level: "error",
            hint: appUrl ? (appUrl.startsWith("https://") ? appUrl : "Має починатися з https://") : "Посилання на Mini App",
        },
        { key: "VITE_ADMIN_ID", ok: hasEnv("VITE_ADMIN_ID"), level: "error", hint: "Твій Telegram id" },
        {
            key: "PAYMENT_CARD_NUMBER",
            ok: hasEnv("PAYMENT_CARD_NUMBER"),
            level: "warning",
            hint: "Картка для ручної оплати",
        },
        {
            key: "CLIENT_URL",
            ok: hasEnv("CLIENT_URL"),
            level: "warning",
            hint: "Домен фронтенду для CORS (без нього дозволено будь-який)",
        },
        {
            key: "GROQ_API_KEY / OPENAI_API_KEY",
            ok: hasEnv("GROQ_API_KEY") || hasEnv("OPENAI_API_KEY"),
            level: "warning",
            hint: "Ключ для розпізнавання голосу",
        },
    ];
};

/** Наступна неділя 20:00 у часовому поясі сервера — час завершення розіграшу */
const nextGiveawayAt = (): string => {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + ((7 - now.getDay()) % 7));
    next.setHours(20, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 7);
    return next.toISOString();
};

// GET /api/admin/system
export const getSystemStatus = (_req: Request, res: Response): void => {
    try {
        const memory = process.memoryUsage();
        res.json({
            uptimeSec: Math.round(process.uptime()),
            nodeVersion: process.version,
            memoryMb: {
                rss: Math.round(memory.rss / 1024 / 1024),
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            },
            mongo: MONGO_STATES[mongoose.connection.readyState] ?? "невідомо",
            timezone: getAdminTimezone(),
            serverTime: new Date().toISOString(),
            speechMode: getSpeechMode(),
            nextGiveawayAt: nextGiveawayAt(),
            broadcast: getBroadcastProgress(),
            cron: CRON_SCHEDULE,
            config: checkConfig(),
        });
    } catch (error) {
        logAdminError("system", error);
        sendError(res, 500, "Не вдалося отримати стан системи");
    }
};

// POST /api/admin/system/clear-cache
export const clearCaches = (_req: Request, res: Response): void => {
    invalidateLeaderboardCache();
    clearDashboardCache();
    clearContentCache();
    res.json({ success: true });
};