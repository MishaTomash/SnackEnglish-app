export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface RepetitionState {
  interval: number;
  easinessFactor: number;
  repetitions?: number;
}

export interface ReviewResult {
  interval: number;
  easinessFactor: number;
  repetitions: number;
  nextReviewDate: string;
}

/**
 * Чиста функція спрощеного алгоритму SuperMemo-2 (SM-2).
 *
 * @param quality Оцінка відповіді від 0 до 5:
 *                < 3 — слово забуто (скидання інтервалу),
 *                >= 3 — слово згадано успішно.
 * @param prevState Попередній стан (інтервал у днях, коефіцієнт легкості, кількість повторень)
 * @param currentDate Дата проходження (за замовчуванням сьогодні)
 */
export const calculateNextReview = (
  quality: ReviewQuality,
  prevState: RepetitionState,
  currentDate: Date = new Date(),
): ReviewResult => {
  const q = quality;
  let repetitions = prevState.repetitions ?? 0;
  let interval = prevState.interval;

  // 1. Оновлення коефіцієнта легкості EF (Easiness Factor)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEf = Math.max(1.3, prevState.easinessFactor + delta);
  const easinessFactor = Number(newEf.toFixed(2));

  // 2. Розрахунок інтервалу (у днях)
  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easinessFactor);
    }
    repetitions += 1;
  }

  // 3. Формування нової дати наступного повторення
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    easinessFactor,
    repetitions,
    nextReviewDate: nextDate.toISOString(),
  };
};
