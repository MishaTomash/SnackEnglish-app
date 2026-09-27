// 📁 Файл: SnackEnglish-app/backend/src/services/giveawaySchedule.ts
/**
 * Коли завершується щотижневий розіграш. ЄДИНЕ місце, де задається час:
 * його використовують cron, бот, адмінка й тексти нагадувань.
 * Час — за часовим поясом сервера (index.ts ставить TZ=Europe/Kyiv).
 *
 * Змінюєш тут — зміни й GIVEAWAY_HOUR у src/shared/lib/giveaway.ts (фронтенд).
 */

/** 0 — неділя */
export const GIVEAWAY_WEEKDAY = 0;
export const GIVEAWAY_HOUR = 17;

/** "17:00" — для текстів */
export const GIVEAWAY_TIME_LABEL = `${String(GIVEAWAY_HOUR).padStart(2, "0")}:00`;

/** Розклад для node-cron: хвилина, година, *, *, день тижня */
export const GIVEAWAY_CRON = `0 ${GIVEAWAY_HOUR} * * ${GIVEAWAY_WEEKDAY}`;

/** Найближче завершення розіграшу (якщо сьогодні неділя й час ще не настав — сьогодні) */
export const nextGiveawayDate = (from: Date = new Date()): Date => {
    const next = new Date(from);
    next.setDate(from.getDate() + ((7 + GIVEAWAY_WEEKDAY - from.getDay()) % 7));
    next.setHours(GIVEAWAY_HOUR, 0, 0, 0);
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 7);
    return next;
};