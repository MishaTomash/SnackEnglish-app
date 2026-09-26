// 📁 Файл: SnackEnglish-app/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Проксі на бекенд (localhost:3000) — однаковий для `npm run dev` і `npm run preview`
const backendProxy = {
  "/api": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
  // Аватари й озвучка (/uploads/avatars, /uploads/tts) лежать на бекенді
  "/uploads": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
  // Socket.IO для дуелей: handshake + WebSocket upgrade
  "/socket.io": {
    target: "http://localhost:3000",
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    // Завжди 5173 — на нього дивиться ngrok. Якщо порт зайнятий (забутий старий Vite),
    // краще одразу побачити помилку, ніж тихо запуститися на 5174, куди ngrok не веде
    port: 5173,
    strictPort: true,
    // true — будь-яка адреса (ngrok-домен може змінюватися). Лише для розробки:
    // на проді фронтенд віддає бекенд зі зібраної папки dist, Vite там не працює
    allowedHosts: true,
    proxy: backendProxy,
  },
  preview: {
    allowedHosts: true,
    proxy: backendProxy,
  },
});