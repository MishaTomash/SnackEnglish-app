// 📁 Файл: SnackEnglish-app/src/shared/lib/supportPrompt.ts
/**
 * Як часто показувати заклик "Підтримати" після уроку: не частіше за раз на кілька днів,
 * щоб не набридати. Час останнього показу — у localStorage (у WebView Telegram працює);
 * якщо сховище недоступне — просто показуємо.
 */
const STORAGE_KEY = "snack_support_prompt_at";
const MIN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export const shouldShowSupportPrompt = (): boolean => {
    try {
        const last = Number(localStorage.getItem(STORAGE_KEY));
        return !Number.isFinite(last) || Date.now() - last >= MIN_INTERVAL_MS;
    } catch {
        return true;
    }
};

export const markSupportPromptShown = (): void => {
    try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
        // сховище недоступне — не страшно
    }
};