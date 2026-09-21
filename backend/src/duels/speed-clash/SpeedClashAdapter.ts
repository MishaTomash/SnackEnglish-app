import { DailyPlan } from "../../models/DailyPlan.js";
import type { DuelGameAdapter, DuelGameState } from "../types.js";
import { WORDS_BY_LEVEL } from "../mockWords.js";

// Утиліта для надійного перемішування (Алгоритм Фішера-Єтса)
const shuffleArray = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export class SpeedClashAdapter implements DuelGameAdapter {
  constructor(public config: { rounds: number; level: string }) {}

  async generateRound(levelOfBothPlayers: (string | null)[]) {
    const level = this.config.level || "A1";
    const plans = await DailyPlan.find({ level }).lean();
    let allWords = plans.flatMap((p) => p.words || []);

    // Фолбек на локальний словник за обраним рівнем
    if (allWords.length < 4) {
      allWords = (WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL["A1"]) as any;
    }

    // ВИПРАВЛЕНО: Надійне перемішування масиву слів
    const shuffled = shuffleArray(allWords);
    const correct = shuffled[0];
    const wrong = shuffled.slice(1, 4);

    // ВИПРАВЛЕНО: Надійне перемішування 4 варіантів відповідей
    const options = shuffleArray([
      correct.translation,
      ...wrong.map((w: any) => w.translation),
    ]);

    return {
      word: correct.word || (correct as any).text,
      options,
      correctAnswer: correct.translation,
      roundStartTime: Date.now(),
    };
  }

  submitAnswer(
    playerId: string,
    answer: any,
    serverTimestamp: number,
    currentState: DuelGameState,
  ) {
    const data = currentState.customData;
    const isCorrect = answer === data.correctAnswer;

    let scoreDelta = 0;
    if (isCorrect) {
      const timeTaken = serverTimestamp - data.roundStartTime;
      // До 10 бонусних балів за швидкість (макс 10 секунд)
      const speedBonus = Math.max(0, Math.floor((10000 - timeTaken) / 1000));
      scoreDelta = 10 + Math.min(speedBonus, 10);
    }

    data.answers[playerId] = { answer, isCorrect, scoreDelta };
    currentState.scores[playerId] =
      (currentState.scores[playerId] || 0) + scoreDelta;

    const playerIds = Object.keys(currentState.scores);
    const answeredCount = Object.keys(data.answers).length;

    // Раунд завершується, якщо хтось відповів правильно, АБО якщо всі дали відповідь
    const isRoundFinished = isCorrect || answeredCount >= playerIds.length;

    return {
      isCorrect,
      scoreDelta,
      roundFinished: isRoundFinished,
      newState: currentState,
    };
  }

  isMatchOver(state: DuelGameState) {
    return state.currentRound >= this.config.rounds;
  }
}
