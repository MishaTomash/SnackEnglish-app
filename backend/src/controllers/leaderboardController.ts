import { Request, Response } from "express";
import { User } from "../models/User.js";

export const getLeaderboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;

    // Беремо всіх, у кого є ім'я з Telegram (username або first_name) —
    // саме воно тепер використовується як відображуване ім'я в Топі.
    const users = await User.find({
      $or: [
        { username: { $exists: true, $nin: [null, ""] } },
        { telegramFirstName: { $exists: true, $nin: [null, ""] } },
      ],
    })
      .select(
        "telegramId username telegramFirstName totalScore customAvatarUrl telegramPhotoUrl streak",
      )
      .lean();

    users.sort((a, b) => {
      const scoreA = (a as any).totalScore || 0;
      const scoreB = (b as any).totalScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return ((b as any).streak || 0) - ((a as any).streak || 0);
    });

    const buildEntry = (u: any, position: number) => ({
      _id: u._id.toString(),
      // Поле лишаємо з ім'ям `nickname` для сумісності з фронтом,
      // але значення — виключно з Telegram.
      nickname: u.username || u.telegramFirstName || "User",
      score: u.totalScore || 0,
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
