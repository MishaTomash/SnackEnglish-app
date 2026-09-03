export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface WebAppInitDataUnsafe {
  query_id?: string;
  user?: TelegramUser;
  auth_date?: string;
  hash?: string;
}

// Допоміжна функція для отримання об'єкта WebApp з window
const getWebApp = () => {
  return (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram
    ?.WebApp as
    | {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: WebAppInitDataUnsafe;
        colorScheme: "light" | "dark";
        onEvent: (eventType: string, eventHandler: () => void) => void;
      }
    | undefined;
};

export const isTelegramEnvironment = (): boolean => {
  const webApp = getWebApp();
  return Boolean(webApp && webApp.initData);
};

export const initTelegramApp = (): void => {
  const webApp = getWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
};

export const getUserData = () => {
  const webApp = getWebApp();
  if (!webApp) return null;

  return {
    initData: webApp.initData,
    initDataUnsafe: webApp.initDataUnsafe,
  };
};

export const subscribeToTheme = (callback: (isDark: boolean) => void): void => {
  const webApp = getWebApp();

  if (!webApp) {
    // Fallback для браузера
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    callback(isDark);
    return;
  }

  const applyTheme = () => {
    const isDark = webApp.colorScheme === "dark";
    callback(isDark);
  };

  webApp.onEvent("themeChanged", applyTheme);
  applyTheme();
};
