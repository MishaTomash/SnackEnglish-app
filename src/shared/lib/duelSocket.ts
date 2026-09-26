import { io, Socket } from "socket.io-client";
import { getTelegramInitData } from "../api/apiClient";

// Як і в apiClient: без VITE_API_URL — той самий домен (відносний шлях),
// що працює і локально через проксі Vite, і на проді, і через тунель на телефоні.
// Раніше за замовчуванням був http://localhost:3000 — на телефоні юзера це не працює.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export const createDuelSocket = (): Socket => {
  // Раніше поза Telegram завжди слався мок-хеш — на проді сервер його тепер відхиляє.
  // getTelegramInitData дає мок лише в режимі розробки.
  const initData = getTelegramInitData();

  return io(`${SOCKET_URL}/duels`, {
    auth: { token: `Bearer ${initData}` },
    autoConnect: false,
  });
};