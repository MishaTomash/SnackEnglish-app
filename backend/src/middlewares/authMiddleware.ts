import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import type { TelegramUser } from "../types/express.js";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
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

    // Видаляємо hash для формування рядка перевірки
    params.delete("hash");

    // Сортуємо параметри в алфавітному порядку та склеюємо через \n
    const sortedData: string[] = [];
    params.sort();
    params.forEach((value, key) => {
      sortedData.push(`${key}=${value}`);
    });
    const dataCheckString = sortedData.join("\n");

    // 1. Секретний ключ: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // 2. Розрахований хеш: HMAC-SHA256(secretKey, dataCheckString)
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Безпечне порівняння буферів однакової довжини
    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    const receivedBuffer = Buffer.from(receivedHash, "hex");

    if (
      calculatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, receivedBuffer)
    ) {
      res.status(401).json({ error: "Unauthorized: Invalid signature" });
      return;
    }

    // Парсинг та валідація даних користувача
    const userRaw = params.get("user");
    if (!userRaw) {
      res
        .status(400)
        .json({ error: "Bad Request: Missing user data in initData" });
      return;
    }

    const parsedUser = JSON.parse(userRaw) as TelegramUser;
    req.user = parsedUser;

    next();
  } catch {
    res
      .status(401)
      .json({ error: "Unauthorized: Failed to authenticate user" });
  }
};
