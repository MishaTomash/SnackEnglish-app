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

export class TugOfWarAdapter implements DuelGameAdapter {
  constructor(public config: { rounds: number; level: string }) {}

  async generateRound(levelOfBothPlayers: (string | null)[]) {
    const level = this.config.level || "A1";
    const mockWordsForLevel =
      (WORDS_BY_LEVEL as Record<string, any[]>)[level] ||
      (WORDS_BY_LEVEL as Record<string, any[]>)["A1"] ||
      [];

    // Шукаємо довгі слова (від 5 літер) у моках
    let longWords = mockWordsForLevel.filter(
      (w: any) => (w.word || w.text || "").length >= 5,
    );

    if (longWords.length === 0) {
      longWords = mockWordsForLevel;
    }

    // Надійно перемішуємо та беремо перше
    const shuffled = shuffleArray(longWords);
    const target = shuffled[0];

    const rawWord = target.word || target.text || "";
    const wordEn = rawWord.toUpperCase().replace(/[^A-Z]/g, "");

    return {
      wordUa: target.translation,
      wordEn: wordEn, // Відправляємо клієнтам для візуалізації
      correctAnswer: wordEn,
      roundStartTime: Date.now(),
      progress: {}, // Зберігаємо історію введених літер кожного гравця
    };
  }

  submitAnswer(
    playerId: string,
    answer: any,
    serverTimestamp: number,
    currentState: DuelGameState,
  ) {
    const data = currentState.customData;
    const target = data.correctAnswer as string;

    if (!data.progress) data.progress = {};
    const currentProgress = data.progress[playerId] || "";

    // Перевіряємо, чи введена літера є наступною правильною літерою
    const nextExpectedChar = target[currentProgress.length];
    const isCorrect = answer === nextExpectedChar;

    let scoreDelta = 0;
    if (isCorrect) {
      data.progress[playerId] = currentProgress + answer;
      scoreDelta = 1; // +1 бал за кожну правильну літеру
      currentState.scores[playerId] =
        (currentState.scores[playerId] || 0) + scoreDelta;
    }

    const newProgress = data.progress[playerId] || "";
    // Раунд завершено, якщо гравець склав усе слово
    const isRoundFinished = newProgress === target;

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
