import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Friendship } from "../models/Friendship.js";
import { bot } from "../bot.js";
import { createUserQuota } from "../middlewares/userRateLimit.js";

/** Той самий формат коду кімнати, що перевіряє сокет дуелей (duelSocketService) */
const ROOM_CODE_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;

// Кожне запрошення — повідомлення від бота; без ліміту ним можна спамити
const inviteQuota = createUserQuota({ windowMs: 10 * 60 * 1000, max: 15 });

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const inviteToDuel = async (req: Request, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) {
      return res.status(401).json({ message: "Не авторизовано" });
    }

    const targetUserId: unknown = req.body?.targetUserId;
    const roomIdRaw: unknown = req.body?.roomId;

    if (typeof targetUserId !== "string" && typeof targetUserId !== "number") {
      return res.status(400).json({ message: "ID суперника обов'язкове" });
    }

    // ВИПРАВЛЕНО: roomId з клієнта вставлявся в посилання без перевірки
    if (roomIdRaw !== undefined && roomIdRaw !== null && roomIdRaw !== "") {
      if (typeof roomIdRaw !== "string" || !ROOM_CODE_PATTERN.test(roomIdRaw)) {
        return res.status(400).json({ message: "Невірний код кімнати" });
      }
    }

    // ВИПРАВЛЕНО: без VITE_APP_URL посилання вело на чийсь старий ngrok-тунель
    const baseUrl = process.env.VITE_APP_URL?.trim();
    if (!baseUrl) {
      console.error("[duels] VITE_APP_URL не задано — неможливо сформувати посилання");
      return res.status(503).json({ message: "Запрошення тимчасово недоступні" });
    }

    const targetKey = String(targetUserId);
    const [sender, targetUser] = await Promise.all([
      User.findOne({ telegramId: senderId }).select("_id username telegramFirstName telegramId"),
      /^[a-f0-9]{24}$/i.test(targetKey) && mongoose.Types.ObjectId.isValid(targetKey)
        ? User.findById(targetKey).select("_id telegramId")
        : Number.isFinite(Number(targetKey))
          ? User.findOne({ telegramId: Number(targetKey) }).select("_id telegramId")
          : null,
    ]);

    if (!sender || !targetUser) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }
    if (sender._id.equals(targetUser._id)) {
      return res.status(400).json({ message: "Не можна викликати самого себе" });
    }

    // ВИПРАВЛЕНО: раніше бот надсилав запрошення БУДЬ-КОМУ з бази — лише друзям
    // (у застосунку кнопка виклику теж є тільки в друзів)
    const areFriends = await Friendship.exists({
      $or: [
        { userId: sender._id, friendId: targetUser._id },
        { userId: targetUser._id, friendId: sender._id },
      ],
      status: "accepted",
    });
    if (!areFriends) {
      return res.status(403).json({ message: "Викликати можна лише друзів" });
    }

    if (!inviteQuota(String(senderId))) {
      return res.status(429).json({ message: "Забагато запрошень. Спробуй трохи пізніше." });
    }

    const finalRoomId =
      typeof roomIdRaw === "string" && roomIdRaw
        ? roomIdRaw
        : crypto.randomBytes(4).toString("hex") + Date.now().toString(36);

    // Пряме посилання на web_app кнопку (start_param читає App.tsx)
    const webAppUrl = `${baseUrl}?startapp=duel_${finalRoomId}`;
    // ВИПРАВЛЕНО: ім'я з "<" або "&" ламало HTML-повідомлення — запрошення не доходило
    const senderName = escapeHtml(sender.username || sender.telegramFirstName || "Твій друг");

    try {
      await bot.telegram.sendMessage(
        targetUser.telegramId,
        `⚔️ <b>${senderName}</b> викликає тебе на дуель!\n\nТицяй кнопку нижче, щоб приєднатись:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "Приєднатися 🚀", web_app: { url: webAppUrl } }]],
          },
        },
      );
    } catch (botError) {
      console.error("Помилка відправки пуша ботом:", botError instanceof Error ? botError.message : botError);
      return res.status(502).json({ message: "Не вдалося надіслати запрошення." });
    }

    req.logEvent("duel_invited", { roomId: finalRoomId, targetUserId: targetKey });

    return res.status(200).json({ success: true, roomId: finalRoomId });
  } catch (error) {
    console.error("Помилка в inviteToDuel:", error);
    return res.status(500).json({ message: "Внутрішня помилка сервера" });
  }
};