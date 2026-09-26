// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/adminHelpers.ts
import type { Response } from "express";

/** Спільні хелпери контролерів адмін-панелі */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Часовий пояс для графіків "по днях" — той самий, що й у сервера (index.ts) */
export const getAdminTimezone = (): string => process.env.TZ || "Europe/Kyiv";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const isLevel = (value: unknown): value is (typeof LEVELS)[number] =>
    typeof value === "string" && (LEVELS as readonly string[]).includes(value);

/** telegramId з URL: лише цифри, інакше null */
export const parseTelegramId = (value: unknown): number | null => {
    if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const isObjectIdString = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

export const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Екранує спецсимволи для пошуку за RegExp */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parsePage = (value: unknown): number => Math.max(1, Math.floor(Number(value)) || 1);

export const parseLimit = (value: unknown, fallback: number, max: number): number =>
    Math.min(max, Math.max(1, Math.floor(Number(value)) || fallback));

export const displayName = (u: {
    customDisplayName?: string | null;
    username?: string | null;
    telegramFirstName?: string | null;
    telegramId?: number;
}): string => u.customDisplayName || u.username || u.telegramFirstName || `#${u.telegramId ?? "?"}`;

/** Ключ дня "YYYY-MM-DD" у часовому поясі адмінки */
export const dayKey = (date: Date): string =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: getAdminTimezone(),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);

/** Початок дня N днів тому (за часом процесу, TZ задано в index.ts) */
export const startOfDayAgo = (daysAgo: number): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
};

export interface DailyPoint {
    date: string;
    value: number;
}

/** Заповнює пропущені дні нулями — графік без "дірок" */
export const fillDays = (rows: { _id: string; count: number }[], days: number): DailyPoint[] => {
    const map = new Map(rows.map((row) => [row._id, row.count]));
    const points: DailyPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const key = dayKey(new Date(Date.now() - i * DAY_MS));
        points.push({ date: key, value: map.get(key) ?? 0 });
    }
    return points;
};

/** Однаковий формат помилок для всієї адмінки */
export const sendError = (res: Response, status: number, message: string): void => {
    res.status(status).json({ error: message });
};

export const logAdminError = (scope: string, error: unknown): void => {
    console.error(`[admin:${scope}]`, error instanceof Error ? error.message : error);
};