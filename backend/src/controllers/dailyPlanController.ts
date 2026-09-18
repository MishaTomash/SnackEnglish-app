import { Request, Response } from "express";
import { DailyPlan } from "../models/DailyPlan.js";
import crypto from "crypto";

const genId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(4).toString("hex")}`;

// НОВИЙ ЕНДПОІНТ: Отримання наступного вільного дня для рівня
export const getNextDayNumber = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const level = (req.query.level as string) || "A1";

    // Шукаємо план з найбільшим dayNumber для цього рівня
    const lastPlan = await DailyPlan.findOne({ level })
      .sort({ dayNumber: -1 }) // Сортування за спаданням
      .lean();

    const nextDay = lastPlan ? lastPlan.dayNumber + 1 : 1;

    res.status(200).json({ nextDay });
  } catch (error) {
    console.error("Next day fetch error:", error);
    res.status(500).json({ error: "Failed to fetch next day number" });
  }
};

export const getLearningCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const level = (req.query.level as string) || "A1";
    const plans = await DailyPlan.find({ level }).sort({ dayNumber: 1 }).lean();

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

    plans.forEach((plan) => {
      if (plan.words && plan.words.length > 0) {
        categories[0].units.push({
          id: `voc-${plan._id}`,
          title: `День ${plan.dayNumber}: ${plan.title}`,
          description: "Нові слова дня",
          emoji: "📚",
          steps: [{ kind: "learn", cards: plan.words }],
        });
      }
      if (plan.quizzes && plan.quizzes.length > 0) {
        categories[1].units.push({
          id: `test-${plan._id}`,
          title: `День ${plan.dayNumber}: ${plan.title}`,
          description: "Перевірка знань",
          emoji: "🧩",
          steps: [{ kind: "quiz", items: plan.quizzes }],
        });
      }
      if (plan.listening && plan.listening.length > 0) {
        categories[2].units.push({
          id: `lis-${plan._id}`,
          title: `День ${plan.dayNumber}: ${plan.title}`,
          description: "Слухай та обирай",
          emoji: "☕",
          steps: [{ kind: "listening", items: plan.listening }],
        });
      }
      if (plan.speaking && plan.speaking.length > 0) {
        categories[3].units.push({
          id: `spk-${plan._id}`,
          title: `День ${plan.dayNumber}: ${plan.title}`,
          description: "Повторюй за диктором",
          emoji: "🗣",
          steps: [{ kind: "speak", items: plan.speaking }],
        });
      }
    });

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
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

    const { level, dayNumber, title, words, quizzes, listening, speaking } =
      req.body;

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

    const plan = await DailyPlan.findOneAndUpdate(
      { level, dayNumber },
      {
        title,
        words: processedWords,
        quizzes: processedQuizzes,
        listening: processedListening,
        speaking: processedSpeaking,
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, plan });
  } catch (error) {
    console.error("Admin save error:", error);
    res.status(500).json({ error: "Failed to save daily plan" });
  }
};
