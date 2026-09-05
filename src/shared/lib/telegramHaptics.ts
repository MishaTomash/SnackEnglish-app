// src/shared/lib/telegramHaptics.ts
// Невеликий хелпер над Telegram.WebApp.HapticFeedback.
// Якщо у вас вже є щось подібне в shared/lib/telegram.ts — перенесіть цю функцію туди
// і імпортуйте її звідти замість окремого файлу.

type TelegramWebAppWithHaptics = {
  HapticFeedback?: {
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    impactOccurred: (
      style: "light" | "medium" | "heavy" | "rigid" | "soft",
    ) => void;
    selectionChanged: () => void;
  };
};

const getHaptics = () =>
  (
    window as unknown as {
      Telegram?: { WebApp?: TelegramWebAppWithHaptics };
    }
  ).Telegram?.WebApp?.HapticFeedback;

/** Вібрація-помилка, коли юзер тикає на заблокований вузол мапи */
export const hapticLockedNode = () => {
  try {
    getHaptics()?.notificationOccurred("error");
  } catch {
    // Немає Telegram-контексту (наприклад, локальний dev у браузері) — ігноруємо
  }
};

/** Легка вібрація при переході на доступну тему */
export const hapticSelectNode = () => {
  try {
    getHaptics()?.impactOccurred("light");
  } catch {
    // no-op поза Telegram
  }
};
