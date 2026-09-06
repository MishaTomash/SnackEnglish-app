import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

// Сервер зберігає стан кімнат. Клієнт нічого не вирішує.
const activeDuels = new Map<string, { player1?: string; player2?: string }>();

export const initSocket = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) return next(new Error("Unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] Користувач підключився: ${userId}`);

    socket.on("join_duel", (roomId: string) => {
      socket.join(roomId);
      console.log(`[Socket] ${userId} увійшов у кімнату ${roomId}`);

      let room = activeDuels.get(roomId) || {};

      // Сервер сам розподіляє слоти і вирішує, коли кімната готова
      if (!room.player1) {
        room.player1 = userId;
      } else if (room.player1 !== userId && !room.player2) {
        room.player2 = userId;
      }

      activeDuels.set(roomId, room);

      if (room.player1 && room.player2) {
        // Коли сервер бачить двох гравців, він ініціює подію для обох одночасно
        io.to(roomId).emit("duel_ready", {
          message: "Зв'язок працює! Сервер бачить обох гравців.",
          timestamp: Date.now(),
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Користувач відключився: ${userId}`);
    });
  });
};
