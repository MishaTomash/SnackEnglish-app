import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import crypto from "crypto";
import { User } from "../models/User.js";
import type { DuelGameState, DuelGameAdapter } from "../duels/types.js";
import { SpeedClashAdapter } from "../duels/speed-clash/SpeedClashAdapter.js";
import { TugOfWarAdapter } from "../duels/tug-of-war/TugOfWarAdapter.js";
import { HotPotatoAdapter } from "../duels/hot-potato/HotPotatoAdapter.js";

interface PlayerData {
  socketId: string;
  userId: string;
  telegramId: number;
  nickname: string;
  avatar: string | null;
  level: string | null;
}

interface ActiveGame {
  adapter: DuelGameAdapter;
  state: DuelGameState | null;
  hostId: string;
  gameId: string;
}

const rooms = new Map<string, Map<string, PlayerData>>();
const activeGames = new Map<string, ActiveGame>();

export const initDuelSocketService = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });
  const duelNamespace = io.of("/duels");

  duelNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token || !token.startsWith("Bearer ")) {
        return next(new Error("Unauthorized"));
      }

      const rawInitData = token.replace("Bearer ", "").trim();
      let telegramId: number = 100000001;

      if (rawInitData !== "mock_hash_for_dev_mode") {
        const params = new URLSearchParams(rawInitData);
        telegramId = JSON.parse(params.get("user") || "{}").id;
        if (!telegramId) return next(new Error("Invalid user"));
      }

      const user = await User.findOne({ telegramId });
      if (!user) return next(new Error("User not found"));

      socket.data.user = {
        userId: user._id.toString(),
        telegramId,
        nickname: user.username || user.telegramFirstName || "Користувач",
        avatar: user.customAvatarUrl || user.telegramPhotoUrl || null,
        level: user.level || "A1",
      };
      next();
    } catch (e) {
      next(new Error("Auth failed"));
    }
  });

  duelNamespace.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on(
      "create_room",
      (data: {
        roomCode: string;
        rounds: number;
        level: string;
        gameId?: string;
      }) => {
        const { roomCode, rounds, level, gameId = "speed-clash" } = data;
        socket.join(roomCode);
        socket.data.roomCode = roomCode;

        if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
        rooms
          .get(roomCode)!
          .set(user.telegramId.toString(), { socketId: socket.id, ...user });

        let adapter: DuelGameAdapter;
        if (gameId === "speed-clash")
          adapter = new SpeedClashAdapter({ rounds, level });
        else if (gameId === "tug-of-war")
          adapter = new TugOfWarAdapter({ rounds, level });
        else if (gameId === "hot-potato")
          adapter = new HotPotatoAdapter({ rounds, level });
        else adapter = new SpeedClashAdapter({ rounds, level });

        const initialState: DuelGameState = {
          scores: {},
          currentRound: 1,
          isOver: false,
          // Хост починає з бомбою
          customData: {
            answers: {},
            bombHolder: user.telegramId.toString(),
            passes: 0,
          },
        };

        activeGames.set(roomCode, {
          adapter,
          state: initialState,
          hostId: user.telegramId.toString(),
          gameId: gameId,
        });
      },
    );

    socket.on("join_room", (roomCode: string) => {
      const game = activeGames.get(roomCode);
      if (!game) return socket.emit("duel:opponent_disconnected");

      socket.join(roomCode);
      socket.data.roomCode = roomCode;

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
      const room = rooms.get(roomCode)!;
      room.set(user.telegramId.toString(), { socketId: socket.id, ...user });

      if (room.size === 2) {
        const players = Array.from(room.values());
        game.state!.scores = {
          [players[0].telegramId.toString()]: 0,
          [players[1].telegramId.toString()]: 0,
        };

        duelNamespace
          .to(players[0].socketId)
          .emit("duel:ready", { opponent: players[1], gameId: game.gameId });
        duelNamespace
          .to(players[1].socketId)
          .emit("duel:ready", { opponent: players[0], gameId: game.gameId });
        duelNamespace.to(roomCode).emit("duel:match_starting");

        setTimeout(async () => {
          const roundData = await game.adapter.generateRound([]);
          // Зберігаємо старі дані (bombHolder), додаючи нові
          game.state!.customData = {
            ...game.state!.customData,
            ...roundData,
            answers: {},
          };
          const { correctAnswer, ...clientRoundData } = game.state!
            .customData as any;
          duelNamespace
            .to(roomCode)
            .emit("duel:round_start", { round: 1, data: clientRoundData });
        }, 2000);
      }
    });

    socket.on("duel:action", (actionData: any) => {
      const roomCode = socket.data.roomCode;
      const game = activeGames.get(roomCode);
      if (!game || !game.state || game.state.isOver) return;

      const gameState = game.state;
      const result = game.adapter.submitAnswer(
        user.telegramId.toString(),
        actionData,
        Date.now(),
        gameState,
      );

      duelNamespace.to(roomCode).emit("duel:player_acted", {
        playerId: user.telegramId.toString(),
        action: { isCorrect: result.isCorrect },
        newScores: gameState.scores,
      });

      if (result.roundFinished) {
        duelNamespace.to(roomCode).emit("duel:round_end", {
          scores: gameState.scores,
          correctAnswer: gameState.customData.correctAnswer,
          answers: gameState.customData.answers,
        });

        if (game.adapter.isMatchOver(gameState)) {
          gameState.isOver = true;
          setTimeout(() => {
            duelNamespace
              .to(roomCode)
              .emit("duel:match_over", { finalScores: gameState.scores });
            activeGames.delete(roomCode);
          }, 3000);
        } else {
          gameState.currentRound += 1;
          setTimeout(async () => {
            const newRound = await game.adapter.generateRound([]);
            // Зберігаємо bombHolder між раундами
            gameState.customData = {
              ...gameState.customData,
              ...newRound,
              answers: {},
            };
            const { correctAnswer, ...clientRoundData } =
              gameState.customData as any;
            duelNamespace
              .to(roomCode)
              .emit("duel:round_start", {
                round: gameState.currentRound,
                data: clientRoundData,
              });
          }, 4000);
        }
      }
    });

    socket.on("disconnect", () => {
      const roomCode = socket.data.roomCode;
      if (roomCode && rooms.has(roomCode)) {
        rooms.get(roomCode)!.delete(user.telegramId.toString());
        if (rooms.get(roomCode)!.size > 0)
          duelNamespace.to(roomCode).emit("duel:opponent_disconnected");
        rooms.delete(roomCode);
      }
    });
  });
};
