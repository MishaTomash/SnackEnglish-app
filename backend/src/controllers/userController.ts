import { Request, Response } from "express";
import { User } from "../models/User.js";

// Повністю описуємо структуру користувача, яку віддає Telegram
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
      if (!user.telegramPhotoUrl && telegramUser.photo_url) {
        user.telegramPhotoUrl = telegramUser.photo_url;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await user.save();
      }
    }

    res.status(200).json(user);
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
      { returnDocument: "after" }, // ВИПРАВЛЕНО
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
      { returnDocument: "after" }, // ВИПРАВЛЕНО
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

    // Якщо multer успішно зберіг файл, записуємо шлях у БД
    if (req.file) {
      updateData.customAvatarUrl = `/uploads/avatars/${req.file.filename}`;
      console.log(
        "[Profile] Файл успішно збережено:",
        updateData.customAvatarUrl,
      ); // ЛОГ ДОДАНО
    }

    const user = await User.findOneAndUpdate(
      { telegramId },
      updateData,
      { returnDocument: "after" }, // ВИПРАВЛЕНО
    );

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

export const updateNickname = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    let { nickname } = req.body;

    if (!nickname || typeof nickname !== "string") {
      res.status(400).json({ error: "Nickname is required" });
      return;
    }

    nickname = nickname.trim();

    const existingUser = await User.findOne({
      nickname: { $regex: new RegExp(`^${nickname}$`, "i") },
      telegramId: { $ne: telegramId },
    });

    if (existingUser) {
      res
        .status(400)
        .json({ error: "Цей нікнейм вже зайнято. Будь ласка, оберіть інший." });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId },
      { nickname },
      { returnDocument: "after" }, // ВИПРАВЛЕНО
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error: any) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ error: "Цей нікнейм вже зайнято. Будь ласка, оберіть інший." });
      return;
    }
    console.error("Error in updateNickname:", error);
    res.status(500).json({ error: "Failed to update nickname" });
  }
};
