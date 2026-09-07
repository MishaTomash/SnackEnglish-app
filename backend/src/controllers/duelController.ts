import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User.js";
import { bot } from "../bot.js";
import mongoose from "mongoose";

export const inviteToDuel = async (req: Request, res: Response) => {
  try {
    const { targetUserId, roomId } = req.body;
    const senderId = (req as any).user?.id;

    if (!senderId) {
      return res.status(401).json({ message: "Не авторизовано" });
    }

    if (!targetUserId) {
      return res.status(400).json({ message: "ID суперника обов'язкове" });
    }

    const sender = await User.findOne({ telegramId: Number(senderId) });

    let targetUser;
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUser = await User.findById(targetUserId);
    } else {
      targetUser = await User.findOne({ telegramId: Number(targetUserId) });
    }

    if (!sender || !targetUser) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    const finalRoomId =
      roomId || crypto.randomBytes(4).toString("hex") + Date.now().toString(36);

    // ВИПРАВЛЕНО: Формуємо прямий URL для web_app кнопки замість t.me
    const baseUrl =
      process.env.VITE_APP_URL ||
      "https://trustable-kerchief-cringing.ngrok-free.dev";
    const webAppUrl = `${baseUrl}?startapp=duel_${finalRoomId}`;

    try {
      await bot.telegram.sendMessage(
        targetUser.telegramId,
        `⚔️ <b>${sender.nickname || sender.telegramFirstName || "Твій друг"}</b> викликає тебе на дуель!\n\nТицяй кнопку нижче, щоб приєднатись:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            // ВИПРАВЛЕНО: Повертаємо надійну web_app кнопку
            inline_keyboard: [
              [{ text: "Приєднатися 🚀", web_app: { url: webAppUrl } }],
            ],
          },
        },
      );
    } catch (botError) {
      console.error("Помилка відправки пуша ботом:", botError);
      return res
        .status(500)
        .json({ message: "Не вдалося надіслати запрошення." });
    }

    return res.status(200).json({ success: true, roomId: finalRoomId });
  } catch (error) {
    console.error("Помилка в inviteToDuel:", error);
    return res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};
