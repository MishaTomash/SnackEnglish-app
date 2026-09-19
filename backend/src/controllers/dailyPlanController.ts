import { Request, Response } from "express";
import { DailyPlan } from "../models/DailyPlan.js";
import { UserUnitProgress } from "../models/UserUnitProgress.js";
import { User } from "../models/User.js";
import crypto from "crypto";

const genId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(4).toString("hex")}`;

export const getNextDayNumber = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const level = (req.query.level as string) || "A1";
    const lastPlan = await DailyPlan.findOne({ level })
      .sort({ dayNumber: -1 })
      .lean();
    const nextDay = lastPlan ? lastPlan.dayNumber + 1 : 1;
    res.status(200).json({ nextDay });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch next day number" });
  }
};

export const getLearningCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const level = (req.query.level as string) || "A1";
    const telegramId = req.user?.id;

    // 1. Отримуємо список ID всіх пройдених планів для цього користувача
    let completedPlanIds: string[] = [];
    if (telegramId) {
      const user = await User.findOne({ telegramId });
      if (user) {
        const completedProgresses = await UserUnitProgress.find({
          userId: user._id,
          unitId: { $regex: /^day_/ },
          status: "completed",
        }).lean();
        completedPlanIds = completedProgresses.map((p) =>
          p.unitId.replace("day_", ""),
        );
      }
    }

    // 2. Шукаємо ПЕРШИЙ ПЛАН, який ще не пройдено
    const nextPlan = await DailyPlan.findOne({
      level,
      _id: { $nin: completedPlanIds },
    })
      .sort({ dayNumber: 1 })
      .lean();

    if (!nextPlan) {
      res
        .status(200)
        .json({ categories: [], noMoreDays: true, planId: null, dayTitle: "" });
      return;
    }

    // 3. Формуємо масив категорій тільки для цього єдиного плану
    const categories: any[] = [
      {
        id: "vocabulary",
        title: "Слова",
        description: "Вивчай нові слова",
        emoji: "📖",
        accent: "amber",
        units: [],
      },
      {
        id: "tests",
        title: "Тести",
        description: "Перевір себе",
        emoji: "✍️",
        accent: "emerald",
        units: [],
      },
      {
        id: "listening",
        title: "Аудіювання",
        description: "Сприймай на слух",
        emoji: "🎧",
        accent: "sky",
        units: [],
      },
      {
        id: "speaking",
        title: "Розмовна практика",
        description: "Говори вголос",
        emoji: "🎤",
        accent: "rose",
        units: [],
      },
    ];

    const vocabularySteps: any[] = [];
    if (nextPlan.words?.length) {
      vocabularySteps.push({ kind: "learn", cards: nextPlan.words });
    }
    if (nextPlan.sentences?.length) {
      vocabularySteps.push({ kind: "sentence", items: nextPlan.sentences });
    }
    if (vocabularySteps.length > 0) {
      categories[0].units.push({
        id: `voc-${nextPlan._id}`,
        title: `День ${nextPlan.dayNumber}`,
        description: nextPlan.title,
        emoji: "📚",
        steps: vocabularySteps,
      });
    }
    if (nextPlan.quizzes?.length) {
      categories[1].units.push({
        id: `test-${nextPlan._id}`,
        title: `День ${nextPlan.dayNumber}`,
        description: nextPlan.title,
        emoji: "🧩",
        steps: [{ kind: "quiz", items: nextPlan.quizzes }],
      });
    }
    if (nextPlan.listening?.length) {
      categories[2].units.push({
        id: `lis-${nextPlan._id}`,
        title: `День ${nextPlan.dayNumber}`,
        description: nextPlan.title,
        emoji: "☕",
        steps: [{ kind: "listening", items: nextPlan.listening }],
      });
    }
    if (nextPlan.speaking?.length) {
      categories[3].units.push({
        id: `spk-${nextPlan._id}`,
        title: `День ${nextPlan.dayNumber}`,
        description: nextPlan.title,
        emoji: "🗣",
        steps: [{ kind: "speak", items: nextPlan.speaking }],
      });
    }

    const activeCategories = categories.filter((c) => c.units.length > 0);

    res.status(200).json({
      categories: activeCategories,
      noMoreDays: false,
      planId: nextPlan._id.toString(),
      dayTitle: `День ${nextPlan.dayNumber}: ${nextPlan.title}`,
    });
  } catch (error) {
    console.error("Categories fetch error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// НОВИЙ ЕНДПОІНТ: Збереження проходження дня
export const completeDailyPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    const { planId } = req.body;

    if (!telegramId || !planId) {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Записуємо проходження дня у UserUnitProgress
    await UserUnitProgress.findOneAndUpdate(
      { userId: user._id, unitId: `day_${planId}` },
      { status: "completed", completedSteps: ["test"] }, // 'test' як технічний маркер для enum
      { upsert: true },
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Complete daily plan error:", error);
    res.status(500).json({ error: "Failed to complete daily plan" });
  }
};

export const createDailyPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    const adminId = Number(process.env.VITE_ADMIN_ID || "0");

    if (!telegramId || telegramId !== adminId) {
      res.status(403).json({ error: "Forbidden: Admin only" });
      return;
    }

    const {
      level,
      dayNumber,
      title,
      words,
      quizzes,
      listening,
      speaking,
      sentences,
    } = req.body;

    const processedWords = (words || []).map((w: any) => ({
      ...w,
      id: w.id || genId("w"),
    }));
    const processedQuizzes = (quizzes || []).map((q: any) => ({
      ...q,
      id: q.id || genId("q"),
    }));
    const processedListening = (listening || []).map((l: any) => ({
      ...l,
      id: l.id || genId("l"),
    }));
    const processedSpeaking = (speaking || []).map((s: any) => ({
      ...s,
      id: s.id || genId("s"),
    }));
    const processedSentences = (sentences || []).map((s: any) => ({
      ...s,
      id: s.id || genId("st"),
    }));

    const plan = await DailyPlan.findOneAndUpdate(
      { level, dayNumber },
      {
        title,
        words: processedWords,
        quizzes: processedQuizzes,
        listening: processedListening,
        speaking: processedSpeaking,
        sentences: processedSentences,
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, plan });
  } catch (error) {
    console.error("Admin save error:", error);
    res.status(500).json({ error: "Failed to save daily plan" });
  }
};
