import { Request, Response } from "express";
import { User } from "../models/User.js";
import { GiveawayHistory } from "../models/GiveawayHistory.js";

export const getLeaderboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;

    const users = await User.find({
      $or: [
        { username: { $exists: true, $nin: [null, ""] } },
        { telegramFirstName: { $exists: true, $nin: [null, ""] } },
      ],
    })
      .select(
        "telegramId username telegramFirstName weeklyScore customAvatarUrl telegramPhotoUrl streak",
      )
      .lean();

    // ЗМІНЕНО: Топ тепер рахується за weeklyScore (поточний тиждень), не за весь час
    users.sort((a, b) => {
      const scoreA = (a as any).weeklyScore || 0;
      const scoreB = (b as any).weeklyScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return ((b as any).streak || 0) - ((a as any).streak || 0);
    });

    const buildEntry = (u: any, position: number) => ({
      _id: u._id.toString(),
      nickname: u.username || u.telegramFirstName || "User",
      score: u.weeklyScore || 0,
      customAvatarUrl: u.customAvatarUrl,
      telegramPhotoUrl: u.telegramPhotoUrl,
      position,
    });

    let currentUserRank = null;
    const top = users.slice(0, 50).map((u, index) => {
      const entry = buildEntry(u, index + 1);
      if (telegramId && u.telegramId === telegramId) {
        currentUserRank = entry;
      }
      return entry;
    });

    if (telegramId && !currentUserRank) {
      const userIndex = users.findIndex((u) => u.telegramId === telegramId);
      if (userIndex !== -1) {
        currentUserRank = buildEntry(users[userIndex], userIndex + 1);
      }
    }

    res.status(200).json({ top, currentUserRank });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};

export const processGiveawayEnd = async (): Promise<void> => {
  // ЗМІНЕНО: переможці розіграшу визначаються за weeklyScore (бали поточного тижня)
  const users = await User.find({
    $or: [
      { username: { $exists: true, $nin: [null, ""] } },
      { telegramFirstName: { $exists: true, $nin: [null, ""] } },
    ],
    weeklyScore: { $gt: 0 },
  })
    .select(
      "username telegramFirstName weeklyScore customAvatarUrl telegramPhotoUrl streak",
    )
    .lean();

  if (users.length === 0) return;

  users.sort((a, b) => {
    const scoreA = (a as any).weeklyScore || 0;
    const scoreB = (b as any).weeklyScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return ((b as any).streak || 0) - ((a as any).streak || 0);
  });

  const top3 = users.slice(0, 3);
  const lastGiveaway = await GiveawayHistory.findOne().sort({ weekNumber: -1 });
  const nextWeek = lastGiveaway ? lastGiveaway.weekNumber + 1 : 1;

  const winners = top3.map((u, i) => ({
    userId: u._id.toString(),
    nickname: (u as any).username || (u as any).telegramFirstName || "User",
    score: (u as any).weeklyScore || 0,
    avatarUrl: (u as any).customAvatarUrl || (u as any).telegramPhotoUrl,
    position: i + 1,
  }));

  await GiveawayHistory.create({
    weekNumber: nextWeek,
    endDate: new Date(),
    winners,
  });

  // ЗМІНЕНО: обнуляємо лише тижневий рахунок; totalScore (весь час, для профілю) лишається
  await User.updateMany({}, { $set: { weeklyScore: 0 } });
};

export const forceEndGiveaway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await processGiveawayEnd();
    res.status(200).json({ message: "Giveaway ended successfully" });
  } catch (error) {
    console.error("Force end giveaway error:", error);
    res.status(500).json({ error: "Failed to end giveaway" });
  }
};

export const getGiveawayHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const history = await GiveawayHistory.find()
      .sort({ weekNumber: -1 })
      .lean();
    res.status(200).json(history);
  } catch (error) {
    console.error("Fetch giveaway history error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};
