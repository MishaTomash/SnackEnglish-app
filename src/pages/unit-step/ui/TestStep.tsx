import { useState, useMemo } from "react";
import { Trophy, XCircle, RotateCcw, ChevronRight } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import type { Word } from "../../../entities/word/types";

// Алгоритм Тасовання Фішера-Єтса
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const TestStep = ({
  words,
  onComplete,
}: {
  words: Word[];
  onComplete: () => void;
}) => {
  const [testIdx, setTestIdx] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const testWords = useMemo(() => words.slice(0, 5), [words]);

  // Генеруємо і перемішуємо варіанти ТІЛЬКИ при зміні testIdx
  const currentOptions = useMemo(() => {
    if (testWords.length === 0) return [];
    const current = testWords[testIdx];
    const otherOptions = words
      .filter((w) => w.id !== current.id)
      .map((w) => w.translation)
      .sort(() => 0.5 - Math.random()) // Легке тасування для вибору випадкових неправильних
      .slice(0, 3);

    return shuffleArray([current.translation, ...otherOptions]);
  }, [testIdx, testWords, words]);

  if (testWords.length < 5)
    return (
      <div className="text-center py-20 text-[var(--text-muted)]">
        Недостатньо слів для тесту
      </div>
    );

  const handleSelect = (selectedText: string) => {
    const isCorrect = selectedText === testWords[testIdx].translation;
    if (isCorrect) {
      setCorrectAnswersCount((prev) => prev + 1);
    }

    if (testIdx < 4) {
      setTestIdx((p) => p + 1);
    } else {
      setIsFinished(true);
    }
  };

  if (isFinished) {
    const isPassed = correctAnswersCount >= 4;

    return (
      <div className="space-y-4 my-auto">
        <Card className="text-center p-6 space-y-4">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isPassed ? "bg-[var(--accent-success)]/20 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/20 text-[var(--accent-error)]"}`}
          >
            {isPassed ? (
              <Trophy className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--text-main)]">
              {Math.round((correctAnswersCount / 5) * 100)}%
            </h2>
            <p className="text-sm font-semibold text-[var(--text-main)]">
              {isPassed ? "Тест складено!" : "Спробуй ще раз"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Правильно: {correctAnswersCount} з 5
            </p>
          </div>
        </Card>
        {isPassed ? (
          <Button onClick={onComplete} variant="primary" className="w-full">
            Завершити юніт
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setCorrectAnswersCount(0);
              setTestIdx(0);
              setIsFinished(false);
            }}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Пройти знову
          </Button>
        )}
      </div>
    );
  }

  const current = testWords[testIdx];

  return (
    <div className="space-y-4 my-auto">
      <ProgressBar progress={((testIdx + 1) / 5) * 100} />
      <Card className="p-6 text-center">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold">
          Перекладіть слово
        </span>
        <h2 className="text-3xl font-extrabold text-[var(--text-main)] mt-2">
          {current.text}
        </h2>
      </Card>
      <div className="space-y-2">
        {currentOptions.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(opt)}
            className="w-full p-4 rounded-2xl font-semibold text-left bg-[var(--bg-card-hover)] border-2 border-[var(--border-color)] hover:border-[var(--accent-cta)] hover:bg-[var(--bg-card-elevated)] text-[var(--text-main)] flex justify-between shadow-sm active:translate-y-1 transition-all"
          >
            <span>{opt}</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
};
