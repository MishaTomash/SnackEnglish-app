import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Friendship } from "../models/Friendship.js";
import { DuelInvite } from "../models/DuelInvite.js";
import { bot } from "../bot.js";
import { Markup } from "telegraf";

const getCurrentUser = async (req: Request) => {
  if (!req.user?.id) return null;
  return await User.findOne({ telegramId: req.user.id });
};

// 1. Створення запрошення (Хост)
export const inviteToDuel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    const { targetUserId } = req.body;

    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    // Перевірка: чи є вони друзями[cite: 14]
    const friendship = await Friendship.findOne({
      status: "accepted",
      $or: [
        { userId: currentUser._id, friendId: targetUser._id },
        { userId: targetUser._id, friendId: currentUser._id },
      ],
    });

    if (!friendship) {
      res.status(403).json({ error: "Запрошувати можна тільки друзів" });
      return;
    }

    const roomCode = crypto.randomUUID();

    // Зберігаємо запрошення в базу
    await DuelInvite.create({
      hostId: currentUser._id,
      guestId: targetUser._id,
      roomCode,
      status: "pending",
    });

    const appUrl = process.env.VITE_APP_URL?.trim() || "";
    const hostName =
      currentUser.nickname || currentUser.telegramFirstName || "Користувач";
    const safeName = hostName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Відправляємо пуш-повідомлення гостю[cite: 15]
    await bot.telegram.sendMessage(
      targetUser.telegramId,
      `⚔️ <b>${safeName}</b> викликає тебе на дуель!`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.webApp(
                "Приєднатися 🚀",
                `${appUrl}?startapp=duel_${roomCode}`,
              ),
            ],
          ],
        },
      },
    );

    res.status(200).json({ roomId: roomCode });
  } catch (error) {
    console.error("Помилка запрошення на дуель:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// 2. Отримання статусу кімнати (для фронтенду)
export const getInviteState = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    const { roomCode } = req.params;

    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const invite = await DuelInvite.findOne({ roomCode }).populate(
      "hostId guestId",
      "nickname telegramFirstName customAvatarUrl telegramPhotoUrl",
    );

    if (!invite) {
      res
        .status(404)
        .json({ error: "Запрошення не знайдено або воно протермінувалось" });
      return;
    }

    const isHost = invite.hostId._id.toString() === currentUser._id.toString();
    const isGuest =
      invite.guestId._id.toString() === currentUser._id.toString();

    if (!isHost && !isGuest) {
      res.status(403).json({ error: "У вас немає доступу до цієї кімнати" });
      return;
    }

    res.status(200).json({ invite, isHost, isGuest });
  } catch (error) {
    res.status(500).json({ error: "Помилка сервера" });
  }
};

// 3. Відповідь гостя на запрошення
export const respondToInvite = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    const { roomCode } = req.params;
    const { accept } = req.body;

    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const invite = await DuelInvite.findOne({
      roomCode,
      guestId: currentUser._id,
    });
    if (!invite) {
      res.status(404).json({ error: "Запрошення не знайдено" });
      return;
    }

    if (invite.status !== "pending") {
      res.status(400).json({ error: "Запрошення вже оброблено" });
      return;
    }

    invite.status = accept ? "accepted" : "declined";
    await invite.save();

    res.status(200).json({ success: true, status: invite.status });
  } catch (error) {
    res.status(500).json({ error: "Помилка сервера" });
  }
};
