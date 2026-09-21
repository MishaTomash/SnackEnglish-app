import { Request, Response } from "express";
import { User, UserProgress, UserUnitProgress } from "../models/index.js";
import { DailyPlan } from "../models/DailyPlan.js";
import { calculateSM2 } from "../utils/spacedRepetition.js";
import { getLearnedWordsCount } from "../services/progressStatsService.js";

// 1. ФІКСАЦІЯ ПРОХОДЖЕННЯ УРОКУ + ДОДАВАННЯ СЛІВ У СЛОВНИК
export const completeLesson = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const { unitId, wordIds } = req.body as {
      unitId?: string;
      wordIds?: string[];
    };
    if (!unitId)
      return void res
        .status(400)
        .json({ error: "Bad Request: Missing unitId" });

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    await UserUnitProgress.findOneAndUpdate(
      { userId: user._id, unitId },
      { $set: { status: "completed" }, $addToSet: { completedSteps: "test" } },
      { new: false, upsert: true },
    );

    const scoreToAdd = 10;
    let finalTotalScore = (user as any).totalScore || 0;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { totalScore: scoreToAdd } },
      { new: true },
    );
    if (updatedUser) finalTotalScore = (updatedUser as any).totalScore;

    if (Array.isArray(wordIds) && wordIds.length > 0) {
      // Затримка старту на 1 день для нових слів
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bulkOps = wordIds.map((wordId) => ({
        updateOne: {
          filter: { userId: user._id, wordId },
          update: {
            $setOnInsert: {
              easinessFactor: 2.5,
              interval: 1,
              repetitions: 0,
              nextReviewDate: tomorrow, // Використовуємо tomorrow замість now
            },
          },
          upsert: true,
        },
      }));
      await UserProgress.bulkWrite(bulkOps);
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

// 2. ОТРИМАННЯ СЛІВ НА ПОВТОРЕННЯ
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

    const dueProgress = await UserProgress.find({
      userId: user._id,
      nextReviewDate: { $lte: now },
    })
      .select("wordId")
      .sort({ nextReviewDate: 1 })
      .limit(30)
      .lean();

    const dueWordIds = dueProgress.map((p) => p.wordId);

    // Шукаємо контент цих ID у DailyPlan
    const allPlans = await DailyPlan.find({}).lean();
    const dueItems: any[] = [];
    const idSet = new Set(dueWordIds);

    for (const plan of allPlans) {
      if (plan.words) {
        plan.words.forEach(
          (w: any) => idSet.has(w.id) && dueItems.push({ type: "word", ...w }),
        );
      }
      if (plan.quizzes) {
        plan.quizzes.forEach(
          (q: any) => idSet.has(q.id) && dueItems.push({ type: "quiz", ...q }),
        );
      }
      if (plan.listening) {
        plan.listening.forEach(
          (l: any) =>
            idSet.has(l.id) && dueItems.push({ type: "listening", ...l }),
        );
      }
      if (plan.speaking) {
        plan.speaking.forEach(
          (s: any) =>
            idSet.has(s.id) && dueItems.push({ type: "speaking", ...s }),
        );
      }
      if (plan.sentences) {
        plan.sentences.forEach(
          (s: any) =>
            idSet.has(s.id) && dueItems.push({ type: "sentence", ...s }),
        );
      }
    }

    res.status(200).json({ dueItems });
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
