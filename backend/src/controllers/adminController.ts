import { Request, Response } from "express";
import { bot } from "../bot.js";
import { broadcastText, isBroadcastRunning } from "../services/broadcastService.js";

/** Ліміт Telegram на довжину текстового повідомлення */
const MAX_TELEGRAM_TEXT_LENGTH = 4096;

export const broadcastToAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = Number(process.env.VITE_ADMIN_ID);

    // Друга лінія захисту (маршрут уже має adminOnly)
    if (!adminId || req.user?.id !== adminId) {
      res.status(403).json({ error: "Forbidden: Admin access only" });
      return;
    }

    const text: unknown = req.body?.text;
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Bad request: text is required" });
      return;
    }
    if (text.length > MAX_TELEGRAM_TEXT_LENGTH) {
      res.status(400).json({ error: `Text is too long (max ${MAX_TELEGRAM_TEXT_LENGTH})` });
      return;
    }

    // ВИПРАВЛЕНО: подвійне натискання запускало дві розсилки — кожен юзер отримував текст двічі
    if (isBroadcastRunning()) {
      res.status(409).json({ error: "Broadcast is already running" });
      return;
    }

    // Запускаємо розсилку у фоні, щоб одразу повернути відповідь клієнту
    broadcastText(bot.telegram, text)
      .then((result) => {
        console.log(`[Broadcast Text] Успішно: ${result.success}, Помилок: ${result.failed}`);
      })
      .catch((error: unknown) => {
        console.error("[Broadcast Text] Розсилку зупинено:", error instanceof Error ? error.message : error);
      });

    res.status(200).json({ message: "Broadcast started successfully" });
  } catch (error) {
    console.error("Broadcast controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};