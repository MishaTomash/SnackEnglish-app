// 📁 Файл: SnackEnglish-app/src/shared/lib/giveaway.ts
/**
 * Час завершення щотижневого розіграшу для інтерфейсу.
 * Має збігатися з backend/src/services/giveawaySchedule.ts (там — cron).
 */
export const GIVEAWAY_TIMEZONE = "Europe/Kyiv";
/** 0 — неділя */
export const GIVEAWAY_WEEKDAY = 0;
export const GIVEAWAY_HOUR = 17;
export const GIVEAWAY_TIME_LABEL = `${String(GIVEAWAY_HOUR).padStart(2, "0")}:00`;