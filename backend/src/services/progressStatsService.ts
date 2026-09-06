import type { Types } from "mongoose";
import { UserProgress } from "../models/UserProgress.js";

/**
 * Поріг "вивчено": слово вважається вивченим, коли пройшло LEARNED_MIN_REPETITIONS
 * поспіль успішних повторень SM-2. Обрано 2, бо саме на цьому кроці інтервал
 * (calculateSM2 у spacedRepetition.ts) стрибає з 1 дня на 6 — типова межа
 * переходу з короткострокової в довгострокову пам'ять.
 *
 * ⚠️ Продуктове рішення: у схемі UserProgress немає явного поля "status",
 * тому це порогове значення — проксі, а не точне бізнес-визначення з БД.
 * Змінюй тут, якщо продукт вирішить інакше.
 */
export const LEARNED_MIN_REPETITIONS = 2;

/**
 * Кількість УНІКАЛЬНИХ вивчених слів користувача.
 * Завдяки унікальному індексу { userId, wordId } у UserProgress
 * countDocuments тут еквівалентний COUNT(DISTINCT wordId).
 */
export async function getLearnedWordsCount(
  userId: Types.ObjectId | string,
): Promise<number> {
  return UserProgress.countDocuments({
    userId,
    repetitions: { $gte: LEARNED_MIN_REPETITIONS },
  });
}
