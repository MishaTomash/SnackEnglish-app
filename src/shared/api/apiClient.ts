import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000/api";

// Мок initData для локальної розробки поза клієнтом Telegram
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

  // Якщо розробка ведеться у Chrome/Firefox без Telegram iframe
  return import.meta.env.DEV ? DEV_FALLBACK_INIT_DATA : "";
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
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
