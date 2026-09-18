import { Request, Response } from "express";
import {
  User,
  UserProgress,
  UserUnitProgress,
  DailyPlan,
} from "../models/index.js";
import { calculateSM2 } from "../utils/spacedRepetition.js";
import { getLearnedWordsCount } from "../services/progressStatsService.js";

// 1. ФІКСАЦІЯ ПРОХОДЖЕННЯ УРОКУ (Новий ендпоінт з точними 10 XP)
export const completeLesson = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const { unitId } = req.body as { unitId?: string };
    if (!unitId)
      return void res
        .status(400)
        .json({ error: "Bad Request: Missing unitId" });

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    const oldProgress = await UserUnitProgress.findOneAndUpdate(
      { userId: user._id, unitId },
      { $set: { status: "completed" }, $addToSet: { completedSteps: "test" } },
      { new: false, upsert: true },
    );

    const isNew = !oldProgress || oldProgress.status !== "completed";
    let scoreToAdd = isNew ? 10 : 0;
    let finalTotalScore = (user as any).totalScore || 0;

    if (scoreToAdd > 0) {
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { totalScore: scoreToAdd } },
        { new: true },
      );
      if (updatedUser) finalTotalScore = (updatedUser as any).totalScore;
    }

    res.status(200).json({
      success: true,
      totalScore: finalTotalScore,
      earnedXp: scoreToAdd,
    });
  } catch (error: unknown) {
    console.error("[completeLesson] Error:", error);
    res.status(500).json({ error: "Failed to complete lesson" });
  }
};

// 2. ОТРИМАННЯ СЛІВ НА ПОВТОРЕННЯ З DAILY PLAN
export const getPracticeWords = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    const now = new Date();

    // Витягуємо всі завершені дні формату day_XYZ
    const completedProgress = await UserUnitProgress.find({
      userId: user._id,
      status: "completed",
      unitId: { $regex: /^day_/ },
    }).lean();

    const learnedWordIds = new Set<string>();

    for (const cp of completedProgress) {
      const planId = cp.unitId.replace("day_", "");
      const plan = await DailyPlan.findById(planId).lean();
      if (plan && plan.words) {
        plan.words.forEach((w: any) => learnedWordIds.add(w.id));
      }
    }

    const allUserProgress = await UserProgress.find({
      userId: user._id,
    }).lean();
    const progressMap = new Map();
    allUserProgress.forEach((p) => progressMap.set(p.wordId.toString(), p));

    const dueWordIds: string[] = [];

    for (const wordId of learnedWordIds) {
      const prog = progressMap.get(wordId);
      if (!prog) {
        dueWordIds.push(wordId); // Нове слово
      } else if (new Date(prog.nextReviewDate) <= now) {
        dueWordIds.push(wordId); // Час повторити
      }
    }

    const selectedIds = dueWordIds.slice(0, 30);

    if (selectedIds.length === 0) {
      res.status(200).json({ words: [] });
      return;
    }

    const words = [];
    for (const id of selectedIds) {
      const plan = await DailyPlan.findOne({ "words.id": id }).lean();
      if (plan && plan.words) {
        const wordObj = plan.words.find((w: any) => w.id === id);
        if (wordObj) words.push(wordObj);
      }
    }

    res.status(200).json({ words });
  } catch (error) {
    console.error(`[Practice API] Error:`, error);
    res.status(500).json({ error: "Failed to fetch practice words." });
  }
};

// 3. ЗБЕРЕЖЕННЯ РЕЗУЛЬТАТУ ПОВТОРЕННЯ
export const reviewWord = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const { wordId, quality } = req.body as {
      wordId?: string;
      quality?: number;
    };
    if (!wordId || quality === undefined || quality < 0 || quality > 5) {
      return void res.status(400).json({ error: "Bad Request" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    let wordObj = null;
    const plan = await DailyPlan.findOne({ "words.id": wordId }).lean();
    if (plan && plan.words) {
      wordObj = plan.words.find((w: any) => w.id === wordId);
    }

    if (!wordObj) return void res.status(404).json({ error: "Word not found" });

    let progress = await UserProgress.findOne({
      userId: user._id,
      wordId: wordId,
    });

    if (!progress) {
      progress = new UserProgress({
        userId: user._id,
        wordId: wordId,
        easinessFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: new Date(),
      });
    }

    const sm2Result = calculateSM2({
      repetitions: progress.repetitions,
      easinessFactor: progress.easinessFactor,
      interval: progress.interval,
      quality,
    });

    progress.repetitions = sm2Result.repetitions;
    progress.easinessFactor = sm2Result.easinessFactor;
    progress.interval = sm2Result.interval;
    progress.nextReviewDate = sm2Result.nextReviewDate;

    await progress.save();

    const wordsLearnedCount = await getLearnedWordsCount(user._id);

    res.status(200).json({
      success: true,
      wordId: wordId,
      ...sm2Result,
      wordsLearnedCount,
    });
  } catch (error: unknown) {
    console.error("reviewWord error:", error);
    res.status(500).json({ error: "Failed to record word review" });
  }
};
