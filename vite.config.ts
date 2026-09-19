import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["trustable-kerchief-cringing.ngrok-free.dev"], // або встановіть true, щоб дозволити будь-які ngrok-домени
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // ДОДАНО: проксі для Socket.IO handshake + WebSocket upgrade.
      // Без цього клієнт (io("/duels") з порожнім SOCKET_URL) намагався
      // з'єднатися з Vite dev-сервером напряму, а не з бекендом на 3000 —
      // запит нікуди не доходив, бекенд мовчав, клієнт ловив connect_error.
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
