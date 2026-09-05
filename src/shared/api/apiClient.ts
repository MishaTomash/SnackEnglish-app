import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

// Якщо VITE_API_URL не задано, використовуємо відносний "/api",
// який автоматично працює і на комп'ютері, і через будь-який тунель на телефоні
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

// Мок initData для локальної розробки у звичайному браузері
const DEV_FALLBACK_INIT_DATA =
  "query_id=AAHdF6IQAAAAAN0XohDhrPqM&user=%7B%22id%22%3A100000001%2C%22first_name%22%3A%22Developer%22%2C%22username%22%3A%22dev_user%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1700000000&hash=mock_hash_for_dev_mode";

function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";

  // 1. Спроба отримати з нативного об'єкта Telegram WebApp
  const tg = (
    window as unknown as {
      Telegram?: {
        WebApp?: {
          initData?: string;
        };
      };
    }
  ).Telegram?.WebApp;

  const realInitData = tg?.initData?.trim();
  if (realInitData) {
    return realInitData;
  }

  // 2. Спроба витягнути з URL-хешу (#tgWebAppData=...)
  try {
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const hashData = hashParams.get("tgWebAppData");
    if (hashData) {
      return decodeURIComponent(hashData);
    }
  } catch {
    // Ігноруємо помилки парсингу хешу
  }

  // 3. Фолбек для розробки поза Telegram
  return import.meta.env.DEV ? DEV_FALLBACK_INIT_DATA : "";
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const initData = getTelegramInitData();

    if (initData && config.headers) {
      config.headers.Authorization = `Bearer ${initData}`;
    }

    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);
