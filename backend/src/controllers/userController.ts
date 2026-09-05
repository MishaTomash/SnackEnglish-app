import { Request, Response } from "express";
import { User } from "../models/User.js"; // Перевір шлях до моделі
import type { TelegramUser } from "../types/express.js";

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const telegramUser = req.user as TelegramUser;

    // Шукаємо користувача або створюємо нового
    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username || telegramUser.first_name,
        level: null,
        onboardingCompleted: false,
      });
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
    const telegramUser = req.user as TelegramUser;
    const { level } = req.body;

    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId: telegramUser.id },
      {
        level,
        onboardingCompleted: true,
      },
      { new: true },
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
