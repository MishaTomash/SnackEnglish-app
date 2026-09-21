import { AnalyticsEvent } from "../models/AnalyticsEvent.js";

/**
 * Записує подію активності користувача в БД.
 * Виклик НЕ блокує відповідь запиту: запис у Mongo виконується
 * асинхронно "у фоні", помилки лише логуються в консоль.
 */
export const logEvent = (
  telegramId: number | undefined,
  eventType: string,
  metadata?: Record<string, unknown>,
): void => {
  if (!telegramId) return;

  void AnalyticsEvent.create({ telegramId, eventType, metadata }).catch(
    (error) => {
      console.error(`[Analytics] Failed to log event "${eventType}":`, error);
    },
  );
};
