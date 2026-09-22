import { Request, Response } from "express";
import { bot } from "../bot.js";

export const sendFeedback = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = Number(process.env.VITE_ADMIN_ID || "0");
    if (!adminId) {
      res.status(500).json({ error: "Admin ID is not configured" });
      return;
    }

    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Bad request: text is required" });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];

    // ТИМЧАСОВИЙ DEBUG — прибери після перевірки
    console.log("[feedback] content-type:", req.headers["content-type"]);
    console.log("[feedback] files received:", files.length);

    const telegramId = req.user?.id;
    const username = req.user?.username
      ? `@${req.user.username}`
      : "без username";
    const firstName = req.user?.first_name || "Користувач";

    const caption =
      `🐞 <b>Повідомлення про проблему</b>\n\n` +
      `Від: ${firstName} (${username})\n` +
      `Telegram ID: <code>${telegramId ?? "невідомо"}</code>\n\n` +
      `${text.trim()}`;

    if (files.length === 0) {
      await bot.telegram.sendMessage(adminId, caption, {
        parse_mode: "HTML",
      });
    } else if (files.length === 1) {
      await bot.telegram.sendPhoto(
        adminId,
        { source: files[0].buffer },
        { caption, parse_mode: "HTML" },
      );
    } else {
      const mediaGroup = files.slice(0, 3).map((file, index) => ({
        type: "photo" as const,
        media: { source: file.buffer },
        caption: index === 0 ? caption : undefined,
        parse_mode: index === 0 ? ("HTML" as const) : undefined,
      }));
      await bot.telegram.sendMediaGroup(adminId, mediaGroup);
    }

    res.status(200).json({ message: "Feedback sent" });
  } catch (error) {
    console.error("Feedback controller error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
