import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  User,
  Unit,
  Word,
  UserProgress,
  UserUnitProgress,
  UnitStepType,
  UnitProgressStatus,
} from "../models/index.js";
import { calculateSM2 } from "../utils/spacedRepetition.js";

/**
 * Отримує всі юніти користувача разом із його персональним прогресом.
 * GET /api/progress/units
 */
export const getUserUnits = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res
        .status(401)
        .json({ error: "Unauthorized: User not found in session" });
      return;
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const units = await Unit.find().sort({ order: 1 });
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
      const prog = progressMap.get(unit._id.toString());
      // Якщо запису прогресу ще немає, перший юніт відкритий ('available'), інші — заблоковані ('locked')
      const defaultStatus: UnitProgressStatus =
        index === 0 ? "available" : "locked";

      return {
        id: unit.unitId,
        _id: unit._id,
        title: unit.title,
        level: unit.level,
        topic: unit.topic,
        order: unit.order,
        grammarTopic: unit.grammarTopic,
        grammarExplanation: unit.grammarExplanation,
        videoUrl: unit.videoUrl,
        readingText: unit.readingText,
        readingTranslation: unit.readingTranslation,
        wordIds: unit.wordIds,
        status: prog?.status ?? defaultStatus,
        completedSteps: prog?.completedSteps ?? [],
      };
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: "Failed to fetch user units", details: error });
  }
};

/**
 * Відзначає крок юніта як пройдений та відкриває наступний юніт у разі завершення.
 * POST /api/progress/step
 */
export const completeStep = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { unitId, stepType } = req.body as {
      unitId?: string;
      stepType?: UnitStepType;
    };

    if (!unitId || !stepType) {
      res
        .status(400)
        .json({ error: "Bad Request: unitId and stepType are required" });
      return;
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const unit = await Unit.findOne({
      $or: [
        { unitId },
        ...(Types.ObjectId.isValid(unitId)
          ? [{ _id: new Types.ObjectId(unitId) }]
          : []),
      ],
    });

    if (!unit) {
      res.status(404).json({ error: "Unit not found" });
      return;
    }

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

    // Якщо здано фінальний тест — юніт вважається повністю завершеним
    const isFinished = stepType === "test";
    if (isFinished) {
      progress.status = "completed";

      // Розблоковуємо наступний юніт за порядковим номером
      const nextUnit = await Unit.findOne({ order: unit.order + 1 });
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

/**
 * Отримує слова для сьогоднішньої щоденної практики інтервального повторення.
 * GET /api/progress/practice
 */
export const getPracticeWords = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = new Date();
    const records = await UserProgress.find({
      userId: user._id,
      nextReviewDate: { $lte: now },
    }).populate("wordId");

    const words = records
      .map((record) => record.wordId)
      .filter((word) => Boolean(word));

    res.status(200).json({
      count: words.length,
      words,
    });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: "Failed to fetch practice words", details: error });
  }
};

/**
 * Фіксує оцінку відповіді користувача (0-5) та оновлює графік SM-2.
 * POST /api/progress/review
 */
export const reviewWord = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { wordId, quality } = req.body as {
      wordId?: string;
      quality?: number;
    };

    if (
      !wordId ||
      quality === undefined ||
      typeof quality !== "number" ||
      quality < 0 ||
      quality > 5
    ) {
      res.status(400).json({
        error: "Bad Request: wordId and quality (integer 0-5) are required",
      });
      return;
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const word = await Word.findOne({
      $or: [
        { wordId },
        ...(Types.ObjectId.isValid(wordId)
          ? [{ _id: new Types.ObjectId(wordId) }]
          : []),
      ],
    });

    if (!word) {
      res.status(404).json({ error: "Word not found" });
      return;
    }

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

    res.status(200).json({
      success: true,
      wordId: word.wordId,
      ...sm2Result,
    });
  } catch (error: unknown) {
    res
      .status(500)
      .json({ error: "Failed to record word review", details: error });
  }
};
