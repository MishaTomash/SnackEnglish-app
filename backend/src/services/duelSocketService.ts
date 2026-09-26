import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import { User } from "../models/User.js";
import type { DuelGameState, DuelGameAdapter } from "../duels/types.js";
import { SpeedClashAdapter } from "../duels/speed-clash/SpeedClashAdapter.js";
import { TugOfWarAdapter } from "../duels/tug-of-war/TugOfWarAdapter.js";
import { HotPotatoAdapter } from "../duels/hot-potato/HotPotatoAdapter.js";
import { verifyTelegramInitData } from "../middlewares/authMiddleware.js";

interface SocketUser {
  userId: string;
  telegramId: number;
  nickname: string;
  avatar: string | null;
  level: string | null;
}

interface PlayerData extends SocketUser {
  socketId: string;
}

interface ActiveGame {
  adapter: DuelGameAdapter;
  state: DuelGameState | null;
  hostId: string;
  gameId: string;
  /** Коли кімнату створено — для прибирання покинутих кімнат */
  createdAt: number;
  /** Матч почався (зайшли двоє) */
  started: boolean;
  /** Раунд триває і приймає відповіді (між раундами — ні) */
  roundActive: boolean;
  /** Таймери паузи між раундами — скасовуються, якщо матч перервано */
  timers: Set<ReturnType<typeof setTimeout>>;
}

interface CreateRoomPayload {
  roomCode?: unknown;
  rounds?: unknown;
  level?: unknown;
  gameId?: unknown;
}

const rooms = new Map<string, Map<string, PlayerData>>();
const activeGames = new Map<string, ActiveGame>();

const ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;
const GAME_IDS = ["speed-clash", "tug-of-war", "hot-potato"] as const;
type DuelGameId = (typeof GAME_IDS)[number];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 20;
const DEFAULT_ROUNDS = 5;

/** Кімната, куди ніхто не зайшов, живе стільки (хост міг піти ділитися посиланням) */
const WAITING_ROOM_TTL_MS = 15 * 60 * 1000;
/** Страховка від "вічних" матчів */
const MAX_GAME_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const isValidRoomCode = (value: unknown): value is string =>
  typeof value === "string" && ROOM_CODE_PATTERN.test(value);

const parseGameId = (value: unknown): DuelGameId =>
  GAME_IDS.find((id) => id === value) ?? "speed-clash";

const parseRounds = (value: unknown): number => {
  const rounds = Math.round(Number(value));
  if (!Number.isFinite(rounds)) return DEFAULT_ROUNDS;
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, rounds));
};

const createAdapter = (gameId: DuelGameId, rounds: number, level: string): DuelGameAdapter => {
  switch (gameId) {
    case "tug-of-war":
      return new TugOfWarAdapter({ rounds, level });
    case "hot-potato":
      return new HotPotatoAdapter({ rounds, level });
    default:
      return new SpeedClashAdapter({ rounds, level });
  }
};

/** Дані раунду без правильної відповіді — щоб її не можна було підглянути в клієнті */
const toClientRoundData = (customData: unknown): Record<string, unknown> => {
  const { correctAnswer: _hidden, ...rest } = (customData ?? {}) as Record<string, unknown>;
  return rest;
};

const getCorrectAnswer = (customData: unknown): unknown =>
  ((customData ?? {}) as Record<string, unknown>).correctAnswer;

const getAnswers = (customData: unknown): unknown =>
  ((customData ?? {}) as Record<string, unknown>).answers;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const initDuelSocketService = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CLIENT_URL || true, methods: ["GET", "POST"] },
  });
  const duelNamespace = io.of("/duels");

  /** Повністю закриває гру: таймери, стан, кімната */
  const closeGame = (roomCode: string) => {
    const game = activeGames.get(roomCode);
    if (game) {
      game.timers.forEach((timer) => clearTimeout(timer));
      game.timers.clear();
      game.roundActive = false;
      if (game.state) game.state.isOver = true;
    }
    activeGames.delete(roomCode);
    rooms.delete(roomCode);
  };

  /** Перериває матч і повідомляє гравців (клієнт на цю подію виходить із дуелі) */
  const abortGame = (roomCode: string) => {
    duelNamespace.to(roomCode).emit("duel:opponent_disconnected");
    closeGame(roomCode);
  };

  /** Таймер, прив'язаний до гри: не спрацює, якщо гру вже закрито */
  const scheduleForGame = (roomCode: string, game: ActiveGame, delayMs: number, task: () => Promise<void> | void) => {
    const timer = setTimeout(() => {
      game.timers.delete(timer);
      if (activeGames.get(roomCode) !== game) return; // гру закрито або замінено
      Promise.resolve()
        .then(task)
        .catch((error: unknown) => {
          // Без catch помилка адаптера (напр., запит слів) обвалила б увесь сервер
          console.error(`[duels] Помилка в кімнаті ${roomCode}:`, errorMessage(error));
          abortGame(roomCode);
        });
    }, delayMs);
    game.timers.add(timer);
  };

  const startRound = async (roomCode: string, game: ActiveGame) => {
    const state = game.state;
    if (!state) return;
    const roundData = await game.adapter.generateRound([]);
    if (activeGames.get(roomCode) !== game) return; // поки генерували раунд, гру закрили
    // Зберігаємо старі дані (bombHolder), додаючи нові
    state.customData = { ...state.customData, ...roundData, answers: {} };
    game.roundActive = true;
    duelNamespace.to(roomCode).emit("duel:round_start", {
      round: state.currentRound,
      data: toClientRoundData(state.customData),
    });
  };

  /** Коли в кімнаті двоє — починаємо матч (з join_room або при поверненні хоста) */
  const tryStartMatch = (roomCode: string, game: ActiveGame) => {
    const room = rooms.get(roomCode);
    if (!room || room.size !== 2 || game.started || !game.state) return;

    const players = Array.from(room.values());
    game.started = true;
    game.state.scores = {
      [players[0].telegramId.toString()]: 0,
      [players[1].telegramId.toString()]: 0,
    };

    duelNamespace.to(players[0].socketId).emit("duel:ready", { opponent: players[1], gameId: game.gameId });
    duelNamespace.to(players[1].socketId).emit("duel:ready", { opponent: players[0], gameId: game.gameId });
    duelNamespace.to(roomCode).emit("duel:match_starting");

    scheduleForGame(roomCode, game, 2000, () => startRound(roomCode, game));
  };

  /** Виводить сокет з попередньої кімнати (один сокет — одна кімната) */
  const leaveCurrentRoom = (socket: Socket, user: SocketUser) => {
    const previous: unknown = socket.data.roomCode;
    if (typeof previous !== "string") return;
    socket.leave(previous);
    socket.data.roomCode = undefined;

    const room = rooms.get(previous);
    const game = activeGames.get(previous);
    if (!room) return;
    const player = room.get(user.telegramId.toString());
    if (player?.socketId === socket.id) room.delete(user.telegramId.toString());

    if (game?.started) abortGame(previous);
    else if (room.size === 0 && game && game.hostId !== user.telegramId.toString()) rooms.delete(previous);
  };

  // Прибирання покинутих кімнат і завислих матчів
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    activeGames.forEach((game, roomCode) => {
      const age = now - game.createdAt;
      if ((!game.started && age > WAITING_ROOM_TTL_MS) || age > MAX_GAME_AGE_MS) {
        if (game.started) abortGame(roomCode);
        else closeGame(roomCode);
      }
    });
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  duelNamespace.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth.token;
      if (typeof token !== "string" || !token.startsWith("Bearer ")) {
        return next(new Error("Unauthorized"));
      }

      // ВИПРАВЛЕНО: раніше підпис не перевірявся взагалі — id юзера брався з рядка як є
      const check = verifyTelegramInitData(token.replace("Bearer ", "").trim());
      if (!check.ok) return next(new Error("Unauthorized"));

      const telegramId = check.user.id;
      const user = await User.findOne({ telegramId })
        .select("username telegramFirstName customAvatarUrl telegramPhotoUrl level blocked")
        .lean();
      if (!user) return next(new Error("User not found"));
      if (user.blocked) return next(new Error("Forbidden"));

      const socketUser: SocketUser = {
        userId: user._id.toString(),
        telegramId,
        nickname: user.username || user.telegramFirstName || "Користувач",
        avatar: user.customAvatarUrl || user.telegramPhotoUrl || null,
        level: user.level || "A1",
      };
      socket.data.user = socketUser;
      next();
    } catch {
      next(new Error("Auth failed"));
    }
  });

  duelNamespace.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    const userKey = user.telegramId.toString();

    socket.on("create_room", (data: CreateRoomPayload) => {
      if (!data || !isValidRoomCode(data.roomCode)) return;
      const roomCode = data.roomCode;

      const existing = activeGames.get(roomCode);
      // Чужу кімнату з таким кодом перезаписати не можна
      if (existing && existing.hostId !== userKey) {
        socket.emit("duel:room_error", { reason: "room_exists" });
        return;
      }
      // Свою кімнату, де матч уже йде, теж не перезаписуємо
      if (existing?.started) return;

      if (socket.data.roomCode !== roomCode) leaveCurrentRoom(socket, user);

      const gameId = parseGameId(data.gameId);
      const rounds = parseRounds(data.rounds);
      const level = typeof data.level === "string" && LEVELS.includes(data.level) ? data.level : (user.level ?? "A1");

      socket.join(roomCode);
      socket.data.roomCode = roomCode;

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
      rooms.get(roomCode)!.set(userKey, { socketId: socket.id, ...user });

      const initialState: DuelGameState = {
        scores: {},
        currentRound: 1,
        isOver: false,
        // Хост починає з бомбою
        customData: {
          answers: {},
          bombHolder: userKey,
          passes: 0,
        },
      };

      const game: ActiveGame = {
        adapter: createAdapter(gameId, rounds, level),
        state: initialState,
        hostId: userKey,
        gameId,
        createdAt: Date.now(),
        started: false,
        roundActive: false,
        timers: existing?.timers ?? new Set(),
      };
      activeGames.set(roomCode, game);

      // Хост повернувся (згортав Telegram, щоб поділитися посиланням), а друг уже чекає
      tryStartMatch(roomCode, game);
    });

    socket.on("join_room", (roomCode: unknown) => {
      if (!isValidRoomCode(roomCode)) return;
      const game = activeGames.get(roomCode);
      if (!game) return socket.emit("duel:opponent_disconnected");

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Map());
      const room = rooms.get(roomCode)!;

      // ВИПРАВЛЕНО: третій гравець або вхід у кімнату, де матч уже йде
      if (game.started || (room.size >= 2 && !room.has(userKey))) {
        socket.emit("duel:room_error", { reason: "room_full" });
        socket.emit("duel:opponent_disconnected"); // старий клієнт реагує саме на цю подію
        return;
      }

      if (socket.data.roomCode !== roomCode) leaveCurrentRoom(socket, user);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      room.set(userKey, { socketId: socket.id, ...user });
      tryStartMatch(roomCode, game);
    });

    socket.on("duel:action", (actionData: unknown) => {
      const roomCode: unknown = socket.data.roomCode;
      if (typeof roomCode !== "string") return;
      const game = activeGames.get(roomCode);
      // ВИПРАВЛЕНО: відповіді в паузі між раундами раніше могли вдруге "завершити" раунд
      // і запустити зайвий таймер — раунди перескакували
      if (!game || !game.state || game.state.isOver || !game.roundActive) return;
      if (!rooms.get(roomCode)?.has(userKey)) return;

      const gameState = game.state;
      let result: ReturnType<DuelGameAdapter["submitAnswer"]>;
      try {
        result = game.adapter.submitAnswer(userKey, actionData as never, Date.now(), gameState);
      } catch (error) {
        console.error(`[duels] submitAnswer у кімнаті ${roomCode}:`, errorMessage(error));
        return;
      }

      duelNamespace.to(roomCode).emit("duel:player_acted", {
        playerId: userKey,
        action: { isCorrect: result.isCorrect },
        newScores: gameState.scores,
      });

      if (!result.roundFinished) return;
      game.roundActive = false;

      duelNamespace.to(roomCode).emit("duel:round_end", {
        scores: gameState.scores,
        correctAnswer: getCorrectAnswer(gameState.customData),
        answers: getAnswers(gameState.customData),
      });

      if (game.adapter.isMatchOver(gameState)) {
        gameState.isOver = true;
        scheduleForGame(roomCode, game, 3000, () => {
          duelNamespace.to(roomCode).emit("duel:match_over", { finalScores: gameState.scores });
          closeGame(roomCode);
        });
      } else {
        gameState.currentRound += 1;
        scheduleForGame(roomCode, game, 4000, () => startRound(roomCode, game));
      }
    });

    socket.on("disconnect", () => {
      const roomCode: unknown = socket.data.roomCode;
      if (typeof roomCode !== "string") return;
      const room = rooms.get(roomCode);
      const game = activeGames.get(roomCode);
      if (!room) return;

      const player = room.get(userKey);
      if (player?.socketId !== socket.id) return; // юзер уже перепідключився іншим сокетом
      room.delete(userKey);

      if (game?.started) {
        // ВИПРАВЛЕНО: раніше гра лишалась у пам'яті назавжди, а таймери раундів крутились далі
        abortGame(roomCode);
      } else if (room.size > 0) {
        duelNamespace.to(roomCode).emit("duel:opponent_disconnected");
      }
      // Кімнату без суперника не видаляємо: хост міг згорнути Telegram, щоб поділитися
      // посиланням. Її прибере cleanupTimer через WAITING_ROOM_TTL_MS.
    });
  });
};