import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  User,
  UserProgress,
  UserUnitProgress,
  UnitStepType,
  UnitProgressStatus,
  Word,
} from "../models/index.js";
import { calculateSM2 } from "../utils/spacedRepetition.js";
import { contentService } from "../services/contentService.js";

export const getUserUnits = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    const level = (req.query.level as string) || (user as any).level || "A1";

    // ОНОВЛЕНО: Читаємо юніти з in-memory сервісу замість DB
    const units = contentService.getUnitsByLevel(level);
    const userProgressList = await UserUnitProgress.find({ userId: user._id });

    const progressMap = new Map<
      string,
      { status: UnitProgressStatus; completedSteps: UnitStepType[] }
    >();
    userProgressList.forEach((prog) => {
      progressMap.set(prog.unitId.toString(), {
        status: prog.status,
        completedSteps: prog.completedSteps,
      });
    });

    const result = units.map((unit, index) => {
      const prog = progressMap.get(unit._id);
      const defaultStatus: UnitProgressStatus =
        index === 0 ? "available" : "locked";

      return {
        ...unit, // Розгортаємо весь підготовлений JSON контракт (id, _id, title, wordIds, grammar тощо)
        status: prog?.status ?? defaultStatus,
        completedSteps: prog?.completedSteps ?? [],
      };
    });

    res.status(200).json({
      units: result,
      level,
      streak: (user as any).streak ?? 0,
    });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: "Failed to fetch user units", details: error });
  }
};

export const completeStep = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId)
      return void res.status(401).json({ error: "Unauthorized" });

    const { unitId, stepType } = req.body as {
      unitId?: string;
      stepType?: UnitStepType;
    };
    if (!unitId || !stepType)
      return void res.status(400).json({ error: "Bad Request" });

    const user = await User.findOne({ telegramId });
    if (!user) return void res.status(404).json({ error: "User not found" });

    // ОНОВЛЕНО: Отримуємо юніт з пам'яті
    const unit = contentService.getUnitById(unitId);
    if (!unit) return void res.status(404).json({ error: "Unit not found" });

    let progress = await UserUnitProgress.findOne({
      userId: user._id,
      unitId: unit._id,
    });

    if (!progress) {
      progress = new UserUnitProgress({
        userId: user._id,
        unitId: unit._id,
        status: "available",
        completedSteps: [],
      });
    }

    if (!progress.completedSteps.includes(stepType)) {
      progress.completedSteps.push(stepType);
    }

    const isFinished = stepType === "test";
    if (isFinished) {
      progress.status = "completed";

      // ОНОВЛЕНО: Отримуємо наступний юніт з пам'яті
      const nextUnit = contentService.getUnitByOrder(
        unit.level,
        unit.order + 1,
      );
      if (nextUnit) {
        const nextProgress = await UserUnitProgress.findOne({
          userId: user._id,
          unitId: nextUnit._id,
        });

        if (!nextProgress) {
          await UserUnitProgress.create({
            userId: user._id,
            unitId: nextUnit._id,
            status: "available",
            completedSteps: [],
          });
        } else if (nextProgress.status === "locked") {
          nextProgress.status = "available";
          await nextProgress.save();
        }
      }
    }

    await progress.save();
    res.status(200).json({
      success: true,
      status: progress.status,
      completedSteps: progress.completedSteps,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to complete step", details: error });
  }
};

export const getPracticeWords = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id; // Number з Telegram

    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 1. Отримуємо внутрішній ObjectId користувача
    const user = await User.findOne({ telegramId });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    console.log(
      `[Practice API] ⏳ Запит слів для повторення (Користувач: ${user._id})`,
    );

    const now = new Date();

    // 2. Шукаємо прогрес за правильним ObjectId
    const overdueProgress = await UserProgress.find({
      userId: user._id,
      nextReviewDate: { $lte: now },
    }).limit(30);

    // ЯВНА ОБРОБКА ПОРОЖНЬОЇ ЧЕРГИ
    if (!overdueProgress || overdueProgress.length === 0) {
      console.log(
        `[Practice API] ℹ️ Черга порожня для користувача ${user._id}.`,
      );
      res.status(200).json({ words: [] });
      return;
    }

    const wordIds = overdueProgress.map((p) => p.wordId);
    const words = await Word.find({ _id: { $in: wordIds } });

    console.log(
      `[Practice API] ✅ Знайдено ${words.length} слів для ${user._id}.`,
    );
    res.status(200).json({ words });
  } catch (error) {
    console.error(`[Practice API] 💥 КРИТИЧНА ПОМИЛКА:`, error);
    res
      .status(500)
      .json({ error: "Внутрішня помилка сервера при формуванні черги." });
  }
};

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

    // ОНОВЛЕНО: Отримуємо слово з пам'яті
    const word = contentService.getWordById(wordId);
    if (!word) return void res.status(404).json({ error: "Word not found" });

    let progress = await UserProgress.findOne({
      userId: user._id,
      wordId: word._id,
    });

    if (!progress) {
      progress = new UserProgress({
        userId: user._id,
        wordId: word._id,
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
    res.status(200).json({ success: true, wordId: word.id, ...sm2Result });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: "Failed to record word review", details: error });
  }
};
