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

/**
 * Перевіряє, що юзер не заблокований адміном, і викликає next().
 * Один легкий lean-запит (лише поле blocked), щоб мінімізувати вплив на швидкість.
 */
const proceedIfNotBlocked = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const telegramId = req.user?.id;

  if (telegramId) {
    const dbUser = await User.findOne({ telegramId }).select("blocked").lean();

    if (dbUser?.blocked) {
      res.status(403).json({ error: "Forbidden: Account is blocked" });
      return;
    }
  }

  req.logEvent = (eventType, metadata) =>
    logEvent(req.user?.id, eventType, metadata);
  next();
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Unauthorized: Missing or invalid token format" });
    return;
  }

  const rawInitData = authHeader.replace("Bearer ", "").trim();
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    res
      .status(500)
      .json({ error: "Internal error: BOT_TOKEN is not configured" });
    return;
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get("hash");

    if (!receivedHash) {
      res.status(401).json({ error: "Unauthorized: Missing hash parameter" });
      return;
    }

    // Дозвіл для локального Mock-токена (розробка поза Telegram)
    if (receivedHash === "mock_hash_for_dev_mode") {
      const userRaw = params.get("user");
      req.user = userRaw
        ? (JSON.parse(userRaw) as TelegramUser)
        : ({
            id: 100000001,
            first_name: "Developer",
            language_code: "en",
          } as TelegramUser);
      await proceedIfNotBlocked(req, res, next);
      return;
    }

    params.delete("hash");

    const sortedData: string[] = [];
    params.sort();
    params.forEach((value, key) => {
      sortedData.push(`${key}=${value}`);
    });
    const dataCheckString = sortedData.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    const receivedBuffer = Buffer.from(receivedHash, "hex");

    if (
      calculatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, receivedBuffer)
    ) {
      res.status(401).json({ error: "Unauthorized: Invalid signature" });
      return;
    }

    const userRaw = params.get("user");
    if (!userRaw) {
      res
        .status(400)
        .json({ error: "Bad Request: Missing user data in initData" });
      return;
    }

    req.user = JSON.parse(userRaw) as TelegramUser;
    await proceedIfNotBlocked(req, res, next);
  } catch {
    res
      .status(401)
      .json({ error: "Unauthorized: Failed to authenticate user" });
  }
};

/**
 * Пропускає далі лише telegram id, що співпадає з VITE_ADMIN_ID.
 * Використовується ПІСЛЯ authMiddleware (потребує req.user).
 */
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const adminId = Number(process.env.VITE_ADMIN_ID || "0");

  if (!req.user?.id || req.user.id !== adminId) {
    res.status(403).json({ error: "Forbidden: Admin only" });
    return;
  }

  next();
};
