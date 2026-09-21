import { DailyPlan } from "../../models/DailyPlan.js";
import type { DuelGameAdapter, DuelGameState } from "../types.js";
import { WORDS_BY_LEVEL } from "../mockWords.js";

// Надійне перемішування (Алгоритм Фішера-Єтса)
const shuffleArray = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export class HotPotatoAdapter implements DuelGameAdapter {
  constructor(public config: { rounds: number; level: string }) {}

  async generateRound(levelOfBothPlayers: (string | null)[]) {
    const level = this.config.level || "A1";
    const plans = await DailyPlan.find({ level }).lean();
    let allWords = plans.flatMap((p) => p.words || []);

    if (allWords.length < 4) {
      allWords = (WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL["A1"]) as any;
    }

    const shuffled = shuffleArray(allWords);
    const correct = shuffled[0];
    const wrong = shuffled.slice(1, 4);

    const options = shuffleArray([
      correct.translation,
      ...wrong.map((w: any) => w.translation),
    ]);

    return {
      word: correct.word || (correct as any).text,
      options,
      correctAnswer: correct.translation,
      roundStartTime: Date.now(),
      // bombHolder та passes зберігаються через duelSocketService
    };
  }

  submitAnswer(
    playerId: string,
    answer: any,
    serverTimestamp: number,
    currentState: DuelGameState,
  ) {
    const data = currentState.customData;
    const playerIds = Object.keys(currentState.scores);
    const opponentId = playerIds.find((id) => id !== playerId) || "opponent";

    // Якщо таймер на фронтенді вичерпався
    if (answer === "TIMEOUT") {
      currentState.scores[opponentId] =
        (currentState.scores[opponentId] || 0) + 1;
      return {
        isCorrect: false,
        scoreDelta: 0,
        roundFinished: true,
        newState: currentState,
      };
    }

    const isCorrect = answer === data.correctAnswer;

    if (isCorrect) {
      // Правильно -> перекидаємо бомбу супернику, збільшуємо кількість пасів (щоб пришвидшити таймер)
      currentState.customData.bombHolder = opponentId;
      currentState.customData.passes =
        (currentState.customData.passes || 0) + 1;
    }

    // Незалежно від правильності генеруємо нове слово (roundFinished: true),
    // але якщо відповідь хибна - бомба лишається у того ж гравця як штраф.
    return {
      isCorrect,
      scoreDelta: 0, // Бали міняються лише коли бомба вибухає
      roundFinished: true,
      newState: currentState,
    };
  }

  isMatchOver(state: DuelGameState) {
    // Гра до першого вибуху (1 бал = кінець гри)
    return Object.values(state.scores).some((score) => score > 0);
  }
}
