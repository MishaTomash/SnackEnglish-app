import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Like } from "../models/Like.js";
import { Friendship } from "../models/Friendship.js";
import { bot } from "../bot.js";
import { Markup } from "telegraf";
import { createUserQuota } from "../middlewares/userRateLimit.js";
import { getUserPosition } from "./leaderboardController.js";

// Заявки в друзі надсилають повідомлення від бота — без ліміту ними можна спамити
const friendRequestQuota = createUserQuota({ windowMs: 10 * 60 * 1000, max: 20 });
// Лайки дешеві, але частий "тиць-тиць" не має навантажувати базу
const likeQuota = createUserQuota({ windowMs: 60 * 1000, max: 60 });

const getCurrentUser = async (req: Request) => {
  if (!req.user?.id) return null;
  return await User.findOne({ telegramId: req.user.id });
};

/**
 * ВИПРАВЛЕНО: невалідний id у URL (/profile/abc) раніше давав CastError і 500.
 * Тепер — звичайна відповідь 404.
 */
const parseUserId = (value: unknown): Types.ObjectId | null =>
  typeof value === "string" && Types.ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(value)
    ? new Types.ObjectId(value)
    : null;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const displayNickname = (u: { username?: string | null; telegramFirstName?: string | null }): string =>
  u.username || u.telegramFirstName || "User";

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetId = parseUserId(req.params.userId);
    if (!targetId) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    const currentUser = await getCurrentUser(req);
    const isOtherUser = Boolean(currentUser && !currentUser._id.equals(targetUser._id));

    // Незалежні запити — паралельно, а не по черзі
    const [likesCount, rank, friendship, myLike] = await Promise.all([
      Like.countDocuments({ targetId: targetUser._id }),
      // Місце в рейтингу ТИЖНЯ — те саме, що на сторінці "Топ"
      getUserPosition({
        _id: targetUser._id as Types.ObjectId,
        weeklyScore: targetUser.weeklyScore,
        streak: targetUser.streak,
      }),
      isOtherUser && currentUser
        ? Friendship.findOne({
          $or: [
            { userId: currentUser._id, friendId: targetUser._id },
            { userId: targetUser._id, friendId: currentUser._id },
          ],
        })
        : null,
      isOtherUser && currentUser
        ? Like.exists({ likerId: currentUser._id, targetId: targetUser._id })
        : null,
    ]);

    let friendStatus = "none";
    if (friendship && currentUser) {
      if (friendship.status === "accepted") {
        friendStatus = "friends";
      } else if (friendship.requestedBy.toString() === currentUser._id.toString()) {
        friendStatus = "pending_sent";
      } else {
        friendStatus = "pending_received";
      }
    }

    res.status(200).json({
      _id: targetUser._id,
      telegramId: targetUser.telegramId,
      nickname: displayNickname(targetUser),
      avatar: targetUser.customAvatarUrl || targetUser.telegramPhotoUrl,
      level: targetUser.level,
      rank,
      // Кубки тижня: однакові з рейтингом і скидаються щонеділі разом із ним
      score: targetUser.weeklyScore || 0,
      streak: targetUser.streak,
      wordsLearnedCount: Number(targetUser.get("wordsLearnedCount")) || 0,
      likesCount,
      // ДОДАНО: раніше клієнт не знав, чи вже лайкнув, і показував порожнє серце
      likedByMe: Boolean(myLike),
      friendStatus,
    });
  } catch (error) {
    console.error("Помилка getProfile:", error);
    res.status(500).json({ error: "Помилка завантаження профілю" });
  }
};

/**
 * ВИПРАВЛЕНО: кнопка на клієнті — перемикач (лайк / зняти лайк), а сервер умів лише
 * ставити лайк. Після "зняття" лічильник на екрані розходився з базою.
 * Тепер повторне натискання знімає лайк.
 */
export const toggleLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetId = parseUserId(req.params.userId);
    if (!targetId) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }
    if (currentUser._id.equals(targetId)) {
      res.status(400).json({ error: "Не можна лайкнути самого себе" });
      return;
    }
    if (!likeQuota(String(currentUser.telegramId))) {
      res.status(429).json({ error: "Забагато дій. Зачекай хвилинку." });
      return;
    }

    const removed = await Like.findOneAndDelete({ likerId: currentUser._id, targetId });
    if (removed) {
      res.status(200).json({ liked: false });
      return;
    }

    // Лайк лише існуючому юзеру
    if (!(await User.exists({ _id: targetId }))) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    try {
      await Like.create({ likerId: currentUser._id, targetId });
    } catch (error) {
      // Подвійний тап: паралельний запит уже поставив лайк
      if (!isDuplicateKeyError(error)) throw error;
    }
    res.status(200).json({ liked: true });
  } catch (error) {
    console.error("Помилка toggleLike:", error);
    res.status(500).json({ error: "Помилка при обробці лайку" });
  }
};

export const sendFriendRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetId = parseUserId(req.params.userId);
    const targetUser = targetId ? await User.findById(targetId) : null;
    if (!targetUser) {
      res.status(404).json({ error: "Користувача не знайдено" });
      return;
    }

    if (currentUser._id.equals(targetUser._id)) {
      res.status(400).json({ error: "Не можна додати себе в друзі" });
      return;
    }

    if (!friendRequestQuota(String(currentUser.telegramId))) {
      res.status(429).json({ error: "Забагато заявок. Спробуй трохи пізніше." });
      return;
    }

    const [minId, maxId] =
      currentUser._id.toString() < targetUser._id.toString()
        ? [currentUser._id, targetUser._id]
        : [targetUser._id, currentUser._id];
    const pairId = `${minId}_${maxId}`;

    if (await Friendship.exists({ pairId })) {
      res.status(400).json({ error: "Заявка вже існує або ви вже друзі" });
      return;
    }

    let friendship;
    try {
      friendship = await Friendship.create({
        userId: currentUser._id,
        friendId: targetUser._id,
        status: "pending",
        requestedBy: currentUser._id,
        pairId,
      });
    } catch (error) {
      // Подвійний тап або зустрічна заявка в ту ж мить
      if (isDuplicateKeyError(error)) {
        res.status(400).json({ error: "Заявка вже існує або ви вже друзі" });
        return;
      }
      throw error;
    }

    const tgFirstName = currentUser.telegramFirstName;
    const tgUsername = currentUser.username ? `@${currentUser.username}` : null;
    const senderName =
      tgFirstName && tgUsername
        ? `${tgFirstName} (${tgUsername})`
        : tgFirstName || tgUsername || `ID: ${currentUser.telegramId}`;

    try {
      await bot.telegram.sendMessage(
        targetUser.telegramId,
        `🍪 <b>${escapeHtml(senderName)}</b> хоче додати тебе в друзі!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback("✅ Прийняти", `f_acc_${friendship._id}`),
                Markup.button.callback("❌ Відхилити", `f_rej_${friendship._id}`),
              ],
            ],
          },
        },
      );
    } catch {
      // Юзер міг заблокувати бота — заявка однаково видна в застосунку
    }

    res.status(200).json({ status: "pending_sent" });
  } catch (error) {
    console.error("Помилка sendFriendRequest:", error);
    res.status(500).json({ error: "Помилка при надсиланні заявки" });
  }
};

export const respondFriendRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const targetId = parseUserId(req.params.userId);
    if (!targetId) {
      res.status(400).json({ error: "Немає активної заявки для відповіді" });
      return;
    }
    const accept = req.body?.accept === true;

    const friendship = await Friendship.findOne({
      $or: [
        { userId: currentUser._id, friendId: targetId },
        { userId: targetId, friendId: currentUser._id },
      ],
      status: "pending",
    });

    if (!friendship || friendship.requestedBy.toString() === currentUser._id.toString()) {
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

interface FriendUser {
  _id: Types.ObjectId;
  username?: string | null;
  telegramFirstName?: string | null;
  customAvatarUrl?: string | null;
  telegramPhotoUrl?: string | null;
  weeklyScore?: number;
  level?: string | null;
}

export const getMyFriends = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const friendships = await Friendship.find({
      $or: [{ userId: currentUser._id }, { friendId: currentUser._id }],
      status: "accepted",
    })
      .populate<{ userId: FriendUser | null; friendId: FriendUser | null }>(
        "userId friendId",
        "username telegramFirstName customAvatarUrl telegramPhotoUrl weeklyScore level",
      )
      .lean();

    const friendsList = friendships
      .map((f) => (f.userId && f.userId._id.equals(currentUser._id) ? f.friendId : f.userId))
      // ВИПРАВЛЕНО: якщо друга видалили з бази, populate давав null і весь список падав з 500
      .filter((friend): friend is FriendUser => friend !== null)
      .map((friend) => ({
        ...friend,
        // ВИПРАВЛЕНО: сторінки друзів і дуелей чекають nickname/avatar, а їх не було —
        // скрізь показувалось "@Користувач" без аватарки
        nickname: displayNickname(friend),
        avatar: friend.customAvatarUrl || friend.telegramPhotoUrl || null,
      }));

    res.status(200).json(friendsList);
  } catch (error) {
    console.error("Помилка getMyFriends:", error);
    res.status(500).json({ error: "Помилка при завантаженні друзів" });
  }
};

export const getMyProfileStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      res.status(401).json({ error: "Неавторизовано" });
      return;
    }

    const [likesCount, friendsCount] = await Promise.all([
      Like.countDocuments({ targetId: currentUser._id }),
      Friendship.countDocuments({
        $or: [{ userId: currentUser._id }, { friendId: currentUser._id }],
        status: "accepted",
      }),
    ]);

    res.status(200).json({ likesCount, friendsCount });
  } catch (error) {
    console.error("Помилка getMyProfileStats:", error);
    res.status(500).json({ error: "Помилка при завантаженні статистики" });
  }
};