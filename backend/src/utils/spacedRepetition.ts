export interface SM2Input {
  repetitions: number;
  easinessFactor: number;
  interval: number;
  quality: number; // Оцінка від 0 (повний провал) до 5 (ідеально)
}

export interface SM2Output {
  repetitions: number;
  easinessFactor: number;
  interval: number;
  nextReviewDate: Date;
}

/**
 * Чистий розрахунок інтервального повторення за алгоритмом SM-2.
 */
export function calculateSM2(input: SM2Input): SM2Output {
  const { repetitions, easinessFactor, interval, quality } = input;

  // Валідація оцінки якості (обмеження від 0 до 5)
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let nextRepetitions: number;
  let nextInterval: number;

  if (q >= 3) {
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * easinessFactor);
    }
    nextRepetitions = repetitions + 1;
  } else {
    // Якщо відповідь неуспішна, цикл повторень скидається на 1 день
    nextRepetitions = 0;
    nextInterval = 1;
  }

  // Формула коригування коефіцієнта легкості:
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const updatedEF = easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  // Мінімальний поріг коефіцієнта легкості в SM-2 завжди 1.3
  const nextEasinessFactor = Math.max(1.3, Number(updatedEF.toFixed(2)));

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

  return {
    repetitions: nextRepetitions,
    easinessFactor: nextEasinessFactor,
    interval: nextInterval,
    nextReviewDate,
  };
}
