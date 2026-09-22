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

  return import.meta.env.DEV ? DEV_FALLBACK_INIT_DATA : "";
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  // ЖОДНИХ Content-Type тут! Axios v1 сам виставить правильний:
  // - application/json для звичайних об'єктів
  // - multipart/form-data; boundary=... для FormData
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const initData = getTelegramInitData();

    if (initData && config.headers) {
      config.headers.set("Authorization", `Bearer ${initData}`);
    }

    // Страховка: якщо хтось явно виставив Content-Type у конкретному
    // виклику для FormData — знімаємо його (axios v1 - це AxiosHeaders,
    // тому використовуємо .set()/.delete(), а не delete obj[key])
    if (config.data instanceof FormData && config.headers) {
      config.headers.set("Content-Type", false as unknown as string);
    }

    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);
