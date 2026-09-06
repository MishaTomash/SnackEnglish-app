import { useEffect, useRef, useState, type FC } from "react";
import type { GameProps, GameResult } from "../types";
import { STARTER_WORDS, type StarterWord } from "./starterWords";

// ---------------------------------------------------------------------------
// Константи гри
// ---------------------------------------------------------------------------

const ROUND_DURATION_MS = 45_000;
/** Часове вікно, за яке рахується бонус за швидкість відповіді. */
const SPEED_BONUS_WINDOW_MS = 4_000;
const BASE_POINTS = 10;
const MAX_SPEED_BONUS = 10;
const CORRECT_DELAY_MS = 350;
const WRONG_DELAY_MS = 700;
const TICK_MS = 100;
const OPTIONS_PER_QUESTION = 3;

// ---------------------------------------------------------------------------
// Типи і дані
// ---------------------------------------------------------------------------

interface Question {
  word: StarterWord;
  options: string[];
  correctText: string;
}

// ---------------------------------------------------------------------------
// Хелпери
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle — не мутує вхідний масив. */
function shuffleArray<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatSeconds(ms: number): string {
  return Math.max(0, Math.ceil(ms / 1000)).toString();
}

/**
 * Будує наступне питання: бере слово з голови черги (queueRef), решту
 * використовує як пул для двох випадкових дистракторів. Порівняння
 * відповіді відбувається за текстом перекладу, а не за індексом варіанту —
 * той самий принцип, що і в BB2.
 */
function buildQuestion(word: StarterWord, allWords: StarterWord[]): Question {
  const distractorPool = allWords.filter((w) => w.id !== word.id);
  const distractors = shuffleArray(distractorPool).slice(
    0,
    OPTIONS_PER_QUESTION - 1,
  );
  const options = shuffleArray([word.ua, ...distractors.map((w) => w.ua)]);
  return { word, options, correctText: word.ua };
}

// ---------------------------------------------------------------------------
// Головний компонент
// ---------------------------------------------------------------------------

interface ResultSummary {
  score: number;
  correctCount: number;
  totalAnswered: number;
  accuracy: number;
}

export const QuickPickGame: FC<GameProps> = ({ onFinish }) => {
  const [timeLeftMs, setTimeLeftMs] = useState(ROUND_DURATION_MS);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [result, setResult] = useState<ResultSummary | null>(null);

  const queueRef = useRef<StarterWord[]>([]);
  const wordsLearnedRef = useRef<Set<string>>(new Set());
  const questionStartRef = useRef<number>(Date.now());

  const nextWord = (): StarterWord => {
    if (queueRef.current.length === 0) {
      queueRef.current = shuffleArray(STARTER_WORDS);
    }
    return queueRef.current.shift()!;
  };

  const startNewQuestion = () => {
    const word = nextWord();
    setQuestion(buildQuestion(word, STARTER_WORDS));
    setSelected(null);
    questionStartRef.current = Date.now();
  };

  // Ініціалізація раунду (і повторний запуск через "Ще раз")
  const startRound = () => {
    queueRef.current = shuffleArray(STARTER_WORDS);
    wordsLearnedRef.current = new Set();
    setTimeLeftMs(ROUND_DURATION_MS);
    setScore(0);
    setCorrectCount(0);
    setTotalAnswered(0);
    setIsLocked(false);
    setResult(null);
    setIsPlaying(true);
    startNewQuestion();
  };

  useEffect(() => {
    startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Секундомір раунду
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setTimeLeftMs((prev) => {
        const next = prev - TICK_MS;
        if (next <= 0) {
          clearInterval(id);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Завершення раунду по вичерпанню часу
  useEffect(() => {
    if (isPlaying && timeLeftMs <= 0) {
      finishRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeftMs, isPlaying]);

  const finishRound = () => {
    setIsPlaying(false);
    setTotalAnswered((total) => {
      setCorrectCount((correct) => {
        setScore((finalScore) => {
          const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
          setResult({
            score: finalScore,
            correctCount: correct,
            totalAnswered: total,
            accuracy,
          });
          return finalScore;
        });
        return correct;
      });
      return total;
    });
  };

  const handleAnswer = (optionText: string) => {
    if (!isPlaying || isLocked || !question) return;

    setIsLocked(true);
    setSelected(optionText);

    const responseTime = Date.now() - questionStartRef.current;
    const isCorrect = optionText === question.correctText;
    const newTotal = totalAnswered + 1;
    setTotalAnswered(newTotal);

    if (isCorrect) {
      const speedRatio =
        Math.min(responseTime, SPEED_BONUS_WINDOW_MS) / SPEED_BONUS_WINDOW_MS;
      const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - speedRatio));
      const points = BASE_POINTS + speedBonus;
      setScore((s) => s + points);
      setCorrectCount((c) => c + 1);
      wordsLearnedRef.current.add(question.word.en);
    }

    const delay = isCorrect ? CORRECT_DELAY_MS : WRONG_DELAY_MS;
    setTimeout(() => {
      setIsLocked(false);
      // Часу може вже не лишитись, поки йшла затримка — перевіряємо перед стартом нового питання
      setTimeLeftMs((t) => {
        if (t > 0) {
          startNewQuestion();
        }
        return t;
      });
    }, delay);
  };

  const handleFinishClick = () => {
    if (!result) return;
    const gameResult: GameResult = {
      score: result.score,
      wordsLearned: Array.from(wordsLearnedRef.current),
      moves: result.totalAnswered,
      timeMs: ROUND_DURATION_MS,
      accuracy: result.accuracy,
    };
    onFinish(gameResult);
  };

  if (result) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center h-full">
        <p className="text-3xl">⚡</p>
        <h2 className="text-xl font-bold text-[var(--text-main)]">
          Час вийшов!
        </h2>
        <div className="w-full max-w-[280px] bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Очки</span>
            <span className="text-[var(--text-main)] font-semibold">
              {result.score}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Правильно</span>
            <span className="text-[var(--text-main)] font-semibold">
              {result.correctCount}/{result.totalAnswered}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Точність</span>
            <span className="text-[var(--text-main)] font-semibold">
              {result.accuracy}%
            </span>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={startRound}
            className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-main)] font-semibold active:bg-[var(--bg-card-hover)]"
          >
            Ще раз
          </button>
          <button
            onClick={handleFinishClick}
            className="px-4 py-2 rounded-xl bg-[var(--accent-cta)] text-[var(--text-accent)] font-semibold active:bg-[var(--accent-cta-active)]"
          >
            Завершити
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
        <p className="text-[var(--text-muted)]">Готуємо раунд...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--text-muted)]">
        <span>
          Час:{" "}
          <span
            className={`font-semibold ${
              timeLeftMs <= 10_000
                ? "text-[var(--accent-error)]"
                : "text-[var(--text-main)]"
            }`}
          >
            0:{formatSeconds(timeLeftMs).padStart(2, "0")}
          </span>
        </span>
        <span>
          Очки:{" "}
          <span className="text-[var(--text-main)] font-semibold">{score}</span>
        </span>
        <span>
          Правильно:{" "}
          <span className="text-[var(--text-main)] font-semibold">
            {correctCount}/{totalAnswered}
          </span>
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 pb-4 space-y-6 max-w-[380px] mx-auto w-full">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 text-center">
          <span className="text-3xl font-extrabold text-[var(--text-main)]">
            {question.word.en}
          </span>
        </div>

        <div className="space-y-2">
          {question.options.map((optionText) => {
            const isSelected = selected === optionText;
            const isCorrectOption = optionText === question.correctText;

            let optionClasses =
              "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)]";
            if (selected) {
              if (isCorrectOption) {
                optionClasses =
                  "bg-[var(--accent-success)] border-[var(--accent-success)] text-[var(--text-accent)]";
              } else if (isSelected) {
                optionClasses =
                  "bg-[var(--bg-card-hover)] border-[var(--accent-error)] text-[var(--text-main)]";
              }
            }

            return (
              <button
                key={optionText}
                type="button"
                disabled={isLocked}
                onClick={() => handleAnswer(optionText)}
                className={`w-full py-4 px-4 rounded-2xl border-2 text-base font-semibold text-center
                  transition-colors duration-150 active:scale-[0.98] touch-manipulation
                  ${optionClasses}`}
              >
                {optionText}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
