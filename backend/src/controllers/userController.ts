import { Request, Response } from "express";
import { User } from "../models/User.js";
import { getLearnedWordsCount } from "../services/progressStatsService.js";

export interface ExtendedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: No user data found" });
      return;
    }

    const telegramUser = req.user as ExtendedTelegramUser;

    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username || undefined,
        telegramFirstName: telegramUser.first_name || undefined,
        telegramPhotoUrl: telegramUser.photo_url || undefined,
        level: null,
        onboardingCompleted: false,
      });
    } else {
      let needsUpdate = false;
      if (!user.telegramFirstName && telegramUser.first_name) {
        user.telegramFirstName = telegramUser.first_name;
        needsUpdate = true;
      }
      if (!user.username && telegramUser.username) {
        user.username = telegramUser.username;
        needsUpdate = true;
      }
      if (!user.telegramPhotoUrl && telegramUser.photo_url) {
        user.telegramPhotoUrl = telegramUser.photo_url;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await user.save();
      }
    }

    const wordsLearnedCount = await getLearnedWordsCount(user._id);

    res.status(200).json({
      ...user.toObject(),
      // Обчислюване поле для сумісності з фронтом/лідербордом.
      // Джерело істини — Telegram: username має пріоритет, інакше first_name.
      nickname: user.username || user.telegramFirstName || "User",
      wordsLearnedCount,
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const completeOnboarding = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    const { level } = req.body;

    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId },
      { level, onboardingCompleted: true },
      { returnDocument: "after" },
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error in completeOnboarding:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
};

export const updateLevel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    const { level } = req.body;

    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId },
      { level },
      { returnDocument: "after" },
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ success: true, level: user.level });
  } catch (error) {
    console.error("Error in updateLevel:", error);
    res.status(500).json({ error: "Failed to update level" });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    const { customDisplayName } = req.body;
    const updateData: any = {};

    if (customDisplayName !== undefined) {
      updateData.customDisplayName = customDisplayName;
    }

    if (req.file) {
      updateData.customAvatarUrl = `/uploads/avatars/${req.file.filename}`;
      console.log(
        "[Profile] Файл успішно збережено:",
        updateData.customAvatarUrl,
      );
    }

    const user = await User.findOneAndUpdate({ telegramId }, updateData, {
      returnDocument: "after",
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};
