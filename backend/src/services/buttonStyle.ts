// 📁 Файл: SnackEnglish-app/backend/src/services/buttonStyle.ts

/**
 * Колір кнопки бота (Telegram Bot API 9.4+):
 *  - "primary" — синя: головна дія (відкрити застосунок, продовжити урок);
 *  - "success" — зелена: позитивна дія (запросити друга, прийняти, увімкнути);
 *  - "danger"  — червона: відмова чи небезпечна дія (відхилити).
 * Без стилю — звичайна кнопка. Старі версії Telegram просто показують кнопку без кольору.
 */
export type ButtonStyle = "primary" | "success" | "danger";

/**
 * Додає кнопці колір. Telegraf 4.16 ще не має поля `style` у типах,
 * але передає кнопку в Telegram як є — тож поле доходить без змін.
 */
export const withStyle = <T extends object>(button: T, style: ButtonStyle): T =>
    ({ ...button, style }) as T;