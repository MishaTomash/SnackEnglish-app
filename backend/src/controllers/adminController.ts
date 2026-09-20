import { Request, Response } from "express";
import { bot } from "../bot.js";
import { broadcastText } from "../services/broadcastService.js";

export const broadcastToAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = Number(process.env.VITE_ADMIN_ID);

    // Перевірка, що запит робить саме адмін (ID збігається)
    if (req.user?.id !== adminId) {
      res.status(403).json({ error: "Forbidden: Admin access only" });
      return;
    }

    const { text } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Bad request: text is required" });
      return;
    }

    // Запускаємо розсилку у фоні, щоб одразу повернути успішну відповідь клієнту
    broadcastText(bot.telegram, text)
      .then((result) => {
        console.log(
          `[Broadcast Text] Успішно: ${result.success}, Помилок: ${result.failed}`,
        );
      })
      .catch((error) => {
        console.error("[Broadcast Text] Сталася помилка:", error);
      });

    res.status(200).json({ message: "Broadcast started successfully" });
  } catch (error) {
    console.error("Broadcast controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
