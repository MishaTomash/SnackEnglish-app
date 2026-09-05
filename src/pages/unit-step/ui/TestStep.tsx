import { useState } from "react";
import { Trophy, XCircle, RotateCcw, ChevronRight } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import type { Word } from "../../../entities/word/types";

export const TestStep = ({
  words,
  onComplete,
}: {
  words: Word[];
  onComplete: () => void;
}) => {
  const [testIdx, setTestIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const testWords = words.slice(0, 5);

  if (testWords.length < 5)
    return (
      <div className="text-center py-20 text-[var(--text-muted)]">
        Недостатньо слів для тесту
      </div>
    );

  const handleSelect = (idx: number) => {
    const nextAnswers = [...answers];
    nextAnswers[testIdx] = idx;
    setAnswers(nextAnswers);
    if (testIdx < 4) setTestIdx((p) => p + 1);
    else setIsFinished(true);
  };

  if (isFinished) {
    const correct = answers.filter((ans) => ans === 0).length;
    const isPassed = correct >= 4;

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
              {Math.round((correct / 5) * 100)}%
            </h2>
            <p className="text-sm font-semibold text-[var(--text-main)]">
              {isPassed ? "Тест складено!" : "Спробуй ще раз"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Правильно: {correct} з 5
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
              setAnswers([]);
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
  const options = [
    current.translation,
    ...words
      .filter((w) => w.id !== current.id)
      .map((w) => w.translation)
      .slice(0, 3),
  ];

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
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
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
