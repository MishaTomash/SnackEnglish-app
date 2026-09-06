import { Request, Response } from "express";
import { User } from "../models/User.js";

export const getLeaderboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;

    const totalUsersInDb = await User.countDocuments();
    const allUsersTest = await User.find({})
      .select("nickname telegramId")
      .lean();

    const users = await User.find({
      nickname: { $exists: true, $ne: null, $ne: "" },
    })
      .select(
        "telegramId nickname totalScore customAvatarUrl telegramPhotoUrl streak",
      )
      .lean();

    console.log(`\n--- DEBUG LEADERBOARD (User: ${telegramId}) ---`);
    console.log(`1. Total users in DB: ${totalUsersInDb}`);
    console.log(`2. Users passing nickname filter: ${users.length}`);
    console.log(`3. ALL users in DB (Raw dump):`, allUsersTest);
    console.log(`-------------------------------------------\n`);

    // Сортуємо напряму за totalScore (streak залишаємо як тай-брейкер при рівних балах)
    users.sort((a, b) => {
      const scoreA = (a as any).totalScore || 0;
      const scoreB = (b as any).totalScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return ((b as any).streak || 0) - ((a as any).streak || 0);
    });

    let currentUserRank = null;
    const top = users.slice(0, 50).map((u, index) => {
      const userRankData = {
        _id: u._id.toString(),
        nickname: u.nickname,
        score: (u as any).totalScore || 0,
        customAvatarUrl: u.customAvatarUrl,
        telegramPhotoUrl: u.telegramPhotoUrl,
        position: index + 1,
      };

      if (telegramId && u.telegramId === telegramId) {
        currentUserRank = userRankData;
      }
      return userRankData;
    });

    if (telegramId && !currentUserRank) {
      const userIndex = users.findIndex((u) => u.telegramId === telegramId);
      if (userIndex !== -1) {
        const u = users[userIndex];
        currentUserRank = {
          _id: u._id.toString(),
          nickname: u.nickname,
          score: (u as any).totalScore || 0,
          customAvatarUrl: u.customAvatarUrl,
          telegramPhotoUrl: u.telegramPhotoUrl,
          position: userIndex + 1,
        };
      }
    }

    res.status(200).json({ top, currentUserRank });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};
