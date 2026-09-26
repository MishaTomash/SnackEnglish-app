// 📁 Файл: SnackEnglish-app/backend/src/services/alertService.ts
import { bot } from "../bot.js";

/**
 * Сповіщення адміну в Telegram про збої на сервері (падіння, помилки cron, 500-ки).
 * Одна й та сама помилка — не частіше, ніж раз на 5 хвилин (решта рахується і
 * згадується в наступному повідомленні), щоб бот не засипав тебе при масовому збої.
 */

const THROTTLE_MS = 5 * 60 * 1000;
const MAX_KEYS = 200;

const lastSentAt = new Map<string, number>();
const suppressedCount = new Map<string, number>();

const describe = (error: unknown): { message: string; stack: string } => {
    if (error instanceof Error) {
        const stack = (error.stack ?? "").split("\n").slice(1, 4).map((line) => line.trim()).join("\n");
        return { message: error.message, stack };
    }
    return { message: typeof error === "string" ? error : JSON.stringify(error)?.slice(0, 300) ?? "невідома помилка", stack: "" };
};

export const notifyAdmin = (title: string, error?: unknown): void => {
    const adminId = Number(process.env.VITE_ADMIN_ID || "0");
    if (!adminId) return;

    const { message, stack } = describe(error);
    const key = `${title}|${message.slice(0, 120)}`;
    const now = Date.now();
    const last = lastSentAt.get(key) ?? 0;

    if (now - last < THROTTLE_MS) {
        suppressedCount.set(key, (suppressedCount.get(key) ?? 0) + 1);
        return;
    }

    if (lastSentAt.size > MAX_KEYS) {
        lastSentAt.clear();
        suppressedCount.clear();
    }
    const suppressed = suppressedCount.get(key) ?? 0;
    lastSentAt.set(key, now);
    suppressedCount.delete(key);

    const time = new Date().toLocaleString("uk-UA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    const text = [
        `⚠️ ${title}`,
        message ? `\n${message.slice(0, 700)}` : "",
        stack ? `\n\n${stack.slice(0, 600)}` : "",
        suppressed > 0 ? `\n\n(ще ${suppressed} таких за останні хвилини)` : "",
        `\n\n🕒 ${time}`,
    ].join("");

    // Без parse_mode: у тексті помилки можуть бути < > & — HTML їх зламав би
    bot.telegram.sendMessage(adminId, text).catch(() => undefined);
};