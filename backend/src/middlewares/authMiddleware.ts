import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import type { TelegramUser } from "../types/express.js";
import { logEvent } from "../services/analyticsService.js";
import { User } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * Хелпер для запису події аналітики з будь-якого контролера.
       * Прив'язаний до telegramId авторизованого юзера.
       * Виклик асинхронний і не блокує обробку запиту.
       */
      logEvent: (eventType: string, metadata?: Record<string, unknown>) => void;
    }
  }
}

const DEV_MOCK_HASH = "mock_hash_for_dev_mode";

const DEV_USER: TelegramUser = {
  id: 100000001,
  first_name: "Developer",
  language_code: "en",
} as TelegramUser;

/**
 * Мок-вхід (initData з hash=mock_hash_for_dev_mode) дозволений ЛИШЕ локально:
 * потрібно явно ALLOW_DEV_AUTH=true у .env, і ніколи при NODE_ENV=production.
 * Раніше він працював і на проді — будь-хто міг увійти під будь-яким id, зокрема адміна.
 */
const isDevAuthAllowed = (): boolean =>
  process.env.ALLOW_DEV_AUTH === "true" && process.env.NODE_ENV !== "production";

/** Скільки секунд initData вважається дійсним (захист від повторного використання старого) */
const DEFAULT_INIT_DATA_MAX_AGE_SEC = 7 * 24 * 60 * 60;

const getInitDataMaxAgeSec = (): number => {
  const value = Number(process.env.INIT_DATA_MAX_AGE_SEC);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INIT_DATA_MAX_AGE_SEC;
};

// ==================== ПЕРЕВІРКА INITDATA ====================

export type InitDataCheck =
  | { ok: true; user: TelegramUser }
  | { ok: false; status: 400 | 401 | 500; error: string };

/**
 * Перевіряє підпис Telegram initData і повертає юзера.
 * Спільна для HTTP (authMiddleware) і Socket.IO (дуелі) — одна точка правди.
 */
export const verifyTelegramInitData = (rawInitData: string): InitDataCheck => {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { ok: false, status: 500, error: "Internal error: BOT_TOKEN is not configured" };
  }

  try {
    // Старий клієнт дуелей міг слати сам рядок мок-хешу
    if (rawInitData === DEV_MOCK_HASH) {
      return isDevAuthAllowed()
        ? { ok: true, user: DEV_USER }
        : { ok: false, status: 401, error: "Unauthorized: Invalid signature" };
    }

    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
      return { ok: false, status: 401, error: "Unauthorized: Missing hash parameter" };
    }

    // Локальний Mock-токен (розробка поза Telegram) — лише з ALLOW_DEV_AUTH
    if (receivedHash === DEV_MOCK_HASH) {
      if (!isDevAuthAllowed()) {
        return { ok: false, status: 401, error: "Unauthorized: Invalid signature" };
      }
      const userRaw = params.get("user");
      return { ok: true, user: userRaw ? (JSON.parse(userRaw) as TelegramUser) : DEV_USER };
    }

    params.delete("hash");

    const sortedData: string[] = [];
    params.sort();
    params.forEach((value, key) => {
      sortedData.push(`${key}=${value}`);
    });
    const dataCheckString = sortedData.join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    const receivedBuffer = Buffer.from(receivedHash, "hex");

    if (
      calculatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, receivedBuffer)
    ) {
      return { ok: false, status: 401, error: "Unauthorized: Invalid signature" };
    }

    // Підпис вірний, але initData міг бути перехоплений давно — перевіряємо вік
    const authDate = Number(params.get("auth_date"));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authDate) || nowSec - authDate > getInitDataMaxAgeSec()) {
      return { ok: false, status: 401, error: "Unauthorized: initData expired" };
    }

    const userRaw = params.get("user");
    if (!userRaw) {
      return { ok: false, status: 400, error: "Bad Request: Missing user data in initData" };
    }

    const user = JSON.parse(userRaw) as TelegramUser;
    if (!user || typeof user.id !== "number") {
      return { ok: false, status: 400, error: "Bad Request: Invalid user data in initData" };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized: Failed to authenticate user" };
  }
};

// ==================== КЕШ БЛОКУВАННЯ ====================

/**
 * Статус "заблокований" кешуємо на 30 с: інакше кожен HTTP-запит кожного юзера
 * робить окремий запит у MongoDB. Блокування з адмінки скидає кеш одразу.
 */
const BLOCKED_CACHE_TTL_MS = 30 * 1000;
const BLOCKED_CACHE_MAX_SIZE = 20000;
const blockedCache = new Map<number, { blocked: boolean; expiresAt: number }>();

export const isUserBlocked = async (telegramId: number): Promise<boolean> => {
  const now = Date.now();
  const cached = blockedCache.get(telegramId);
  if (cached && cached.expiresAt > now) return cached.blocked;

  const dbUser = await User.findOne({ telegramId }).select("blocked").lean();
  const blocked = Boolean(dbUser?.blocked);

  if (blockedCache.size >= BLOCKED_CACHE_MAX_SIZE) blockedCache.clear(); // простий захист від росту пам'яті
  blockedCache.set(telegramId, { blocked, expiresAt: now + BLOCKED_CACHE_TTL_MS });
  return blocked;
};

/** Викликати після зміни blocked (адмінка), щоб зміна діяла одразу */
export const invalidateBlockedCache = (telegramId: number): void => {
  blockedCache.delete(telegramId);
};

// ==================== MIDDLEWARE ====================

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
    return;
  }

  const result = verifyTelegramInitData(authHeader.replace("Bearer ", "").trim());
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  req.user = result.user;

  try {
    if (await isUserBlocked(result.user.id)) {
      res.status(403).json({ error: "Forbidden: Account is blocked" });
      return;
    }
  } catch (error) {
    console.error("[auth] Не вдалося перевірити блокування:", error instanceof Error ? error.message : error);
    res.status(503).json({ error: "Service temporarily unavailable" });
    return;
  }

  req.logEvent = (eventType, metadata) => logEvent(req.user?.id, eventType, metadata);
  next();
};

/**
 * Пропускає далі лише telegram id, що співпадає з VITE_ADMIN_ID.
 * Використовується ПІСЛЯ authMiddleware (потребує req.user).
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  const adminId = Number(process.env.VITE_ADMIN_ID || "0");

  if (!adminId || !req.user?.id || req.user.id !== adminId) {
    res.status(403).json({ error: "Forbidden: Admin only" });
    return;
  }

  next();
};