import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Like } from "../models/Like.js";
import { Friendship } from "../models/Friendship.js";
import { bot } from "../bot.js";
import { Markup } from "telegraf";

const getCurrentUser = async (req: Request) => {
  if (!req.user?.id) return null;
  return await User.findOne({ telegramId: req.user.id });
};

export const getProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const targetUserId = req.params.userId as string;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    const currentUser = await getCurrentUser(req);

    const likesCount = await Like.countDocuments({ targetId: targetUser._id });

    const rank =
      (await User.countDocuments({
        $or: [
          { totalScore: { $gt: targetUser.totalScore } },
          {
            totalScore: targetUser.totalScore,
            streak: { $gt: targetUser.streak },
          },
        ],
      })) + 1;

    let friendStatus = "none";
    if (
      currentUser &&
      currentUser._id.toString() !== targetUser._id.toString()
    ) {
      const friendship = await Friendship.findOne({
        $or: [
          { userId: currentUser._id, friendId: targetUser._id },
          { userId: targetUser._id, friendId: currentUser._id },
        ],
      });

      if (friendship) {
        if (friendship.status === "accepted") {
          friendStatus = "friends";
        } else if (
          friendship.requestedBy.toString() === currentUser._id.toString()
        ) {
          friendStatus = "pending_sent";
        } else {
          friendStatus = "pending_received";
        }
      }
    }

    res.status(200).json({
      _id: targetUser._id,
      nickname: targetUser.nickname,
      avatar: targetUser.customAvatarUrl || targetUser.telegramPhotoUrl,
      level: targetUser.level,
      rank,
      score: targetUser.totalScore,
      streak: targetUser.streak,
      wordsLearnedCount: (targetUser as any).wordsLearnedCount || 0,
      likesCount,
      friendStatus,
    });
  } catch (error) {
    console.error("Помилка getProfile:", error);
    res.status(500).json({ error: "Помилка завантаження профілю" });
  }
};

export const toggleLike = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetUserId = req.params.userId as string;
    if (currentUser._id.toString() === targetUserId) {
      res.status(400).json({ error: "Не можна лайкнути самого себе" });
      return;
    }

    // ВИПРАВЛЕННЯ TYPESCRIPT: Явно перетворюємо рядок параметру на ObjectId для суворої типізації
    const targetObjectId = new Types.ObjectId(targetUserId);

    const existingLike = await Like.findOne({
      likerId: currentUser._id,
      targetId: targetObjectId,
    });

    if (existingLike) {
      // Лайк ставиться тільки один раз, фармінг заблоковано
      res.status(200).json({ liked: true });
      return;
    }

    await Like.create({ likerId: currentUser._id, targetId: targetObjectId });
    res.status(200).json({ liked: true });
  } catch (error) {
    console.error("Помилка toggleLike:", error);
    res.status(500).json({ error: "Помилка при обробці лайку" });
  }
};

export const sendFriendRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetUserId = req.params.userId as string;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    if (currentUser._id.toString() === targetUser._id.toString()) {
      res.status(400).json({ error: "Не можна додати себе в друзі" });
      return;
    }

    const minId =
      currentUser._id.toString() < targetUser._id.toString()
        ? currentUser._id
        : targetUser._id;
    const maxId =
      currentUser._id.toString() < targetUser._id.toString()
        ? targetUser._id
        : currentUser._id;
    const pairId = `${minId}_${maxId}`;

    let friendship = await Friendship.findOne({ pairId });

    if (friendship) {
      res.status(400).json({ error: "Заявка вже існує або ви вже друзі" });
      return;
    }

    friendship = await Friendship.create({
      userId: currentUser._id,
      friendId: targetUser._id,
      status: "pending",
      requestedBy: currentUser._id,
      pairId,
    });

    const tgFirstName = currentUser.telegramFirstName;
    const tgUsername = currentUser.username ? `@${currentUser.username}` : null;
    const tgId = currentUser.telegramId;

    let senderName = "Користувач";
    if (tgFirstName && tgUsername) {
      senderName = `${tgFirstName} (${tgUsername})`;
    } else if (tgFirstName) {
      senderName = tgFirstName;
    } else if (tgUsername) {
      senderName = tgUsername;
    } else {
      senderName = `ID: ${tgId}`;
    }

    // Екрануємо спецсимволи для HTML-розмітки Telegram
    const safeName = senderName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    try {
      console.log(
        `[DEBUG] Відправка заявки від ${safeName} до ${targetUser.telegramId}`,
      );
      await bot.telegram.sendMessage(
        targetUser.telegramId,
        `🍪 <b>${safeName}</b> хоче додати тебе в друзі!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  "✅ Прийняти",
                  `f_acc_${friendship._id}`,
                ),
                Markup.button.callback(
                  "❌ Відхилити",
                  `f_rej_${friendship._id}`,
                ),
              ],
            ],
          },
        },
      );
    } catch (botError) {
      console.error("Не вдалося надіслати повідомлення ботом:", botError);
    }

    res.status(200).json({ status: "pending_sent" });
  } catch (error) {
    console.error("Помилка sendFriendRequest:", error);
    res.status(500).json({ error: "Помилка при надсиланні заявки" });
  }
};

export const respondFriendRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetUserId = req.params.userId as string;
    const { accept } = req.body;

    const friendship = await Friendship.findOne({
      $or: [
        { userId: currentUser._id, friendId: targetUserId },
        { userId: targetUserId, friendId: currentUser._id },
      ],
      status: "pending",
    });

    if (
      !friendship ||
      friendship.requestedBy.toString() === currentUser._id.toString()
    ) {
      res.status(400).json({ error: "Немає активної заявки для відповіді" });
      return;
    }

    if (accept) {
      friendship.status = "accepted";
      await friendship.save();
      res.status(200).json({ status: "friends" });
    } else {
      await friendship.deleteOne();
      res.status(200).json({ status: "none" });
    }
  } catch (error) {
    console.error("Помилка respondFriendRequest:", error);
    res.status(500).json({ error: "Помилка при обробці заявки" });
  }
};

export const getMyFriends = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const friendships = await Friendship.find({
      $or: [{ userId: currentUser._id }, { friendId: currentUser._id }],
      status: "accepted",
    }).populate(
      "userId friendId",
      "nickname customAvatarUrl telegramPhotoUrl totalScore level",
    );

    const friendsList = friendships.map((f) => {
      const isUser1 = f.userId._id.toString() === currentUser._id.toString();
      const friendData = isUser1 ? f.friendId : f.userId;
      return friendData;
    });

    res.status(200).json(friendsList);
  } catch (error) {
    console.error("Помилка getMyFriends:", error);
    res.status(500).json({ error: "Помилка при завантаженні друзів" });
  }
};
export const getMyProfileStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const likesCount = await Like.countDocuments({ targetId: currentUser._id });
    const friendsCount = await Friendship.countDocuments({
      $or: [{ userId: currentUser._id }, { friendId: currentUser._id }],
      status: "accepted",
    });

    res.status(200).json({ likesCount, friendsCount });
  } catch (error) {
    console.error("Помилка getMyProfileStats:", error);
    res.status(500).json({ error: "Помилка при завантаженні статистики" });
  }
};
