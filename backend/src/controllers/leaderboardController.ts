// 📁 Файл: SnackEnglish-app/backend/src/controllers/leaderboardController.ts
import { Request, Response } from "express";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { GiveawayHistory } from "../models/GiveawayHistory.js";

/**
 * Рейтинг тижня (weeklyScore) і тижневий розіграш.
 * Раніше кожен запит рейтингу вантажив УСІХ юзерів у пам'ять і сортував у JS —
 * з ростом бази це ставало повільним і їло пам'ять. Тепер сортування й ліміт
 * робить MongoDB по індексу { weeklyScore: -1, streak: -1, _id: 1 } (див. User.ts),
 * а місце юзера поза топом рахується одним countDocuments.
 */

const LEADERBOARD_SIZE = 50;
/** Топ однаковий для всіх — кешуємо ненадовго, щоб не ходити в базу на кожен запит */
const TOP_CACHE_TTL_MS = 15 * 1000;
const GIVEAWAY_HISTORY_LIMIT = 52;

// У рейтинг потрапляють лише юзери з ім'ям (як і раніше)
export const HAS_NAME_FILTER = {
  $or: [
    { username: { $exists: true, $nin: [null, ""] } },
    { telegramFirstName: { $exists: true, $nin: [null, ""] } },
  ],
};

// Порядок: бали тижня, потім стрік, потім _id — щоб при рівних балах місця були стабільні
export const RANK_SORT = { weeklyScore: -1, streak: -1, _id: 1 } as const;

const LEADER_FIELDS =
  "telegramId username telegramFirstName weeklyScore customAvatarUrl telegramPhotoUrl streak";

interface LeaderUser {
  _id: Types.ObjectId;
  telegramId: number;
  username?: string | null;
  telegramFirstName?: string | null;
  weeklyScore?: number | null;
  customAvatarUrl?: string | null;
  telegramPhotoUrl?: string | null;
  streak?: number | null;
}

interface LeaderboardEntry {
  _id: string;
  nickname: string;
  score: number;
  customAvatarUrl?: string | null;
  telegramPhotoUrl?: string | null;
  position: number;
}

const buildEntry = (u: LeaderUser, position: number): LeaderboardEntry => ({
  _id: u._id.toString(),
  nickname: u.username || u.telegramFirstName || "User",
  score: u.weeklyScore || 0,
  customAvatarUrl: u.customAvatarUrl,
  telegramPhotoUrl: u.telegramPhotoUrl,
  position,
});

let topCache: { users: LeaderUser[]; expiresAt: number } | null = null;
let topRequest: Promise<LeaderUser[]> | null = null;

/** Скидає кеш топу (після розіграшу; можна викликати й після нарахування балів) */
export const invalidateLeaderboardCache = (): void => {
  topCache = null;
};

const loadTopUsers = async (): Promise<LeaderUser[]> => {
  if (topCache && topCache.expiresAt > Date.now()) return topCache.users;
  // Якщо запит уже летить — чекаємо його, а не робимо ще один
  if (!topRequest) {
    topRequest = User.find(HAS_NAME_FILTER)
      .select(LEADER_FIELDS)
      .sort(RANK_SORT)
      .limit(LEADERBOARD_SIZE)
      .lean<LeaderUser[]>()
      .then((users) => {
        topCache = { users, expiresAt: Date.now() + TOP_CACHE_TTL_MS };
        return users;
      })
      .finally(() => {
        topRequest = null;
      });
  }
  return topRequest;
};

/**
 * Місце юзера в рейтингу тижня: скільки юзерів стоять вище + 1.
 * Той самий порядок, що й у топі, — тому профіль і рейтинг показують однакове місце.
 */
export const getUserPosition = async (
  me: Pick<LeaderUser, "_id" | "weeklyScore" | "streak">,
): Promise<number> => {
  const score = me.weeklyScore || 0;
  const streak = me.streak || 0;
  const above = await User.countDocuments({
    $and: [
      HAS_NAME_FILTER,
      {
        $or: [
          { weeklyScore: { $gt: score } },
          { weeklyScore: score, streak: { $gt: streak } },
          { weeklyScore: score, streak, _id: { $lt: me._id } },
        ],
      },
    ],
  });
  return above + 1;
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    const topUsers = await loadTopUsers();

    let currentUserRank: LeaderboardEntry | null = null;
    const top = topUsers.map((u, index) => {
      const entry = buildEntry(u, index + 1);
      if (telegramId && u.telegramId === telegramId) currentUserRank = entry;
      return entry;
    });

    if (telegramId && !currentUserRank) {
      const me = await User.findOne({ $and: [{ telegramId }, HAS_NAME_FILTER] })
        .select(LEADER_FIELDS)
        .lean<LeaderUser>();
      if (me) currentUserRank = buildEntry(me, await getUserPosition(me));
    }

    res.status(200).json({ top, currentUserRank });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};

// Захист від подвійного завершення (cron і кнопка адміна одночасно)
let giveawayInProgress = false;

export const processGiveawayEnd = async (): Promise<void> => {
  if (giveawayInProgress) {
    console.warn("[giveaway] Завершення вже виконується — повторний виклик пропущено");
    return;
  }
  giveawayInProgress = true;

  try {
    // Переможці розіграшу визначаються за weeklyScore (бали поточного тижня)
    const top3 = await User.find({ $and: [HAS_NAME_FILTER, { weeklyScore: { $gt: 0 } }] })
      .select(LEADER_FIELDS)
      .sort(RANK_SORT)
      .limit(3)
      .lean<LeaderUser[]>();

    if (top3.length === 0) return;

    const lastGiveaway = await GiveawayHistory.findOne().sort({ weekNumber: -1 });
    const nextWeek = lastGiveaway ? lastGiveaway.weekNumber + 1 : 1;

    const winners = top3.map((u, i) => ({
      userId: u._id.toString(),
      nickname: u.username || u.telegramFirstName || "User",
      score: u.weeklyScore || 0,
      // null з бази модель розіграшу не приймає — лише рядок або відсутнє поле
      avatarUrl: u.customAvatarUrl || u.telegramPhotoUrl || undefined,
      position: i + 1,
    }));

    await GiveawayHistory.create({
      weekNumber: nextWeek,
      endDate: new Date(),
      winners,
    });

    // Обнуляємо лише тижневий рахунок; totalScore (весь час, для профілю) лишається
    await User.updateMany({ weeklyScore: { $ne: 0 } }, { $set: { weeklyScore: 0 } });
    invalidateLeaderboardCache();
  } finally {
    giveawayInProgress = false;
  }
};

export const forceEndGiveaway = async (req: Request, res: Response): Promise<void> => {
  try {
    await processGiveawayEnd();
    res.status(200).json({ message: "Giveaway ended successfully" });
  } catch (error) {
    console.error("Force end giveaway error:", error);
    res.status(500).json({ error: "Failed to end giveaway" });
  }
};

export const getGiveawayHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Історія росте щотижня — віддаємо останній рік, а не все
    const history = await GiveawayHistory.find()
      .sort({ weekNumber: -1 })
      .limit(GIVEAWAY_HISTORY_LIMIT)
      .lean();
    res.status(200).json(history);
  } catch (error) {
    console.error("Fetch giveaway history error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};