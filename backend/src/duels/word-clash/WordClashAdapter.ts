import type { DuelGameAdapter, DuelGameState } from "../types.js";

// Розширений словник з рівнями
const VOCABULARY = [
  {
    word: "Apple",
    correct: "Яблуко",
    wrong: ["Груша", "Слива", "Банан"],
    level: "A1",
  },
  {
    word: "Water",
    correct: "Вода",
    wrong: ["Вогонь", "Земля", "Повітря"],
    level: "A1",
  },
  {
    word: "Journey",
    correct: "Подорож",
    wrong: ["Зупинка", "Робота", "Дім"],
    level: "A2",
  },
  {
    word: "Decide",
    correct: "Вирішувати",
    wrong: ["Думати", "Плакати", "Бігти"],
    level: "A2",
  },
  {
    word: "Provide",
    correct: "Забезпечувати",
    wrong: ["Забирати", "Ховати", "Шукати"],
    level: "B1",
  },
  {
    word: "Demand",
    correct: "Вимагати",
    wrong: ["Просити", "Давати", "Мовчати"],
    level: "B1",
  },
  {
    word: "Resilience",
    correct: "Стійкість",
    wrong: ["Повага", "Відмова", "Слабкість"],
    level: "B2",
  },
  {
    word: "Ambiguous",
    correct: "Двозначний",
    wrong: ["Чіткий", "Великий", "Швидкий"],
    level: "B2",
  },
  {
    word: "Ephemeral",
    correct: "Швидкоплинний",
    wrong: ["Вічний", "Важкий", "Світлий"],
    level: "C1",
  },
  {
    word: "Fastidious",
    correct: "Вибагливий",
    wrong: ["Простий", "Легкий", "Добрий"],
    level: "C1",
  },
];

export class WordClashAdapter implements DuelGameAdapter {
  private totalRounds: number;
  private vocab: typeof VOCABULARY;

  constructor(settings?: { rounds?: number; level?: string }) {
    this.totalRounds = settings?.rounds || 5;
    const targetLevel = settings?.level || "B1";

    // Фільтруємо слова за вибраним рівнем (якщо слів мало — беремо всі як фолбек)
    const filtered = VOCABULARY.filter((v) => v.level === targetLevel);
    this.vocab = filtered.length > 0 ? filtered : VOCABULARY;
  }

  generateRound(_levelOfBothPlayers: (string | null)[]) {
    const item = this.vocab[Math.floor(Math.random() * this.vocab.length)];
    const options = [item.correct, ...item.wrong].sort(
      () => Math.random() - 0.5,
    );

    return {
      word: item.word,
      options,
      correctAnswer: item.correct,
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
    if (data.answers[playerId])
      return {
        isCorrect: false,
        scoreDelta: 0,
        roundFinished: false,
        newState: currentState,
      };

    const isCorrect = answer === data.correctAnswer;
    const responseTime = serverTimestamp - data.roundStartTime;
    data.answers[playerId] = { isCorrect, responseTime, answer };

    let scoreDelta = 0;
    if (isCorrect) scoreDelta = 10;

    const playerIds = Object.keys(currentState.scores);
    const roundFinished = Object.keys(data.answers).length === 2;

    if (roundFinished) {
      const [p1, p2] = playerIds;
      const a1 = data.answers[p1];
      const a2 = data.answers[p2];

      if (a1.isCorrect && a2.isCorrect) {
        if (a1.responseTime < a2.responseTime) {
          if (playerId === p1) scoreDelta += 5;
          else currentState.scores[p1] += 5;
        } else if (a2.responseTime < a1.responseTime) {
          if (playerId === p2) scoreDelta += 5;
          else currentState.scores[p2] += 5;
        }
      }
    }

    currentState.scores[playerId] += scoreDelta;
    return { isCorrect, scoreDelta, roundFinished, newState: currentState };
  }

  isMatchOver(state: DuelGameState): boolean {
    return state.currentRound >= this.totalRounds;
  }
}
