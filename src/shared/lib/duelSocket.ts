import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SOCKET_URL = API_URL.replace(/\/api$/, "").replace(/\/$/, "");

export const createDuelSocket = (): Socket => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";

  return io(`${SOCKET_URL}/duels`, {
    auth: { token: `Bearer ${initData}` },
    autoConnect: false,
  });
};
