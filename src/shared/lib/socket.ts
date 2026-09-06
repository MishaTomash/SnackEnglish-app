import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SOCKET_URL = API_URL.replace(/\/api$/, "").replace(/\/$/, "");

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
