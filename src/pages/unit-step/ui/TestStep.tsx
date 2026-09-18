import { useState, useMemo, memo } from "react";
import {
  Trophy,
  CheckCircle2,
  RotateCcw,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import type { Word } from "../../../entities/word/types";

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
};

const QuizView = memo(({ data, index, onNext, isRetry, total }: any) => {
  const [answered, setAnswered] = useState(false);
  const [input, setInput] = useState("");
  const options = useMemo(
    () => shuffleArray([...(data.options || [])]),
    [data.options],
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 text-center">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold block mb-2">
          Запитання {index + 1} з {total}
        </span>
        <h2 className="text-xl font-extrabold text-[var(--text-main)]">
          {data.question}
        </h2>
      </Card>
      <div className="space-y-2">
        {options.map((opt: string, i: number) => {
          const isCorrectOpt = opt === data.correctAnswer;
          return (
            <button
              key={i}
              onClick={() => {
                setInput(opt);
                setAnswered(true);
              }}
              disabled={answered}
              className={`w-full p-4 rounded-2xl font-semibold text-left border-2 transition-all flex justify-between items-center ${answered ? (isCorrectOpt ? "bg-[var(--accent-success)]/10 border-[var(--accent-success)] text-[var(--accent-success)]" : input === opt ? "bg-[var(--accent-error)]/10 border-[var(--accent-error)] text-[var(--accent-error)]" : "bg-[var(--bg-card)] border-[var(--border-color)] opacity-50") : "bg-[var(--bg-card-hover)] border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent-cta)]"}`}
            >
              <span>{opt}</span>
              {answered && isCorrectOpt && <CheckCircle2 className="w-5 h-5" />}
              {answered && !isCorrectOpt && input === opt && (
                <XCircle className="w-5 h-5" />
              )}
            </button>
          );
        })}
      </div>
      {answered && (
        <Button
          onClick={() => onNext(input === data.correctAnswer ? 1 : 0, input)}
          variant="primary"
          className="w-full mt-4"
        >
          {isRetry ? "До підсумків" : "Наступна частина"}
        </Button>
      )}
    </div>
  );
});

const ScrambleView = memo(({ data, index, onNext, isRetry, total }: any) => {
  const wordsArray = useMemo(
    () =>
      (data.sentence || "")
        .replace(/[.!?,"']/g, "")
        .trim()
        .split(" ")
        .filter(Boolean),
    [data.sentence],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(
    shuffleArray([...wordsArray]),
  );
  const [answered, setAnswered] = useState(false);

  const isCorrect =
    selected.join(" ").toLowerCase() === wordsArray.join(" ").toLowerCase();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 space-y-6 text-center">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold block mb-2">
          Завдання {index + 1} з {total}: Складіть речення
        </span>
        <p className="text-lg font-bold text-[var(--text-main)] italic opacity-90 pb-2">
          "{data.translation}"
        </p>
        <div className="flex flex-wrap gap-2 justify-center min-h-[4rem] p-4 bg-[var(--bg-card-elevated)] rounded-2xl border-2 border-[var(--border-color)]">
          {selected.map((word, i) => (
            <Button
              key={i}
              variant="primary"
              size="sm"
              onClick={() => {
                if (!answered) {
                  setSelected((s) => s.filter((_, idx) => idx !== i));
                  setAvailable((a) => [...a, word]);
                }
              }}
              className="px-3 py-1.5"
            >
              {word}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {available.map((word, i) => (
            <Button
              key={i}
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!answered) {
                  setAvailable((a) => a.filter((_, idx) => idx !== i));
                  setSelected((s) => [...s, word]);
                }
              }}
              className="px-3 py-1.5"
            >
              {word}
            </Button>
          ))}
        </div>
        {answered && (
          <div
            className={`p-3 rounded-xl text-sm font-bold ${isCorrect ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/10 text-[var(--accent-error)]"}`}
          >
            {isCorrect ? "Правильно!" : `Помилка. Правильно: ${data.sentence}`}
          </div>
        )}
      </Card>
      {!answered ? (
        <Button
          onClick={() => setAnswered(true)}
          disabled={selected.length === 0}
          variant="primary"
          className="w-full"
        >
          Перевірити
        </Button>
      ) : (
        <Button
          onClick={() => onNext(isCorrect ? 1 : 0, selected.join(" "))}
          variant="primary"
          className="w-full"
        >
          {isRetry ? "До підсумків" : "Наступна частина"}
        </Button>
      )}
    </div>
  );
});
// --- Динамічний компонент для Type-Answer (Активне пригадування) ---
const TypeAnswerView = memo(({ data, index, onNext, isRetry, total }: any) => {
  const [answered, setAnswered] = useState(false);
  const [input, setInput] = useState("");

  const normInput = normalize(input);
  const normAnswer = normalize(data.correctAnswer || "");

  // Допускаємо 1 помилку (одруківку), якщо слово/фраза має більше 4 літер
  const isCorrect =
    normInput === normAnswer ||
    (normAnswer.length > 4 && levenshteinDistance(normInput, normAnswer) <= 1);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 text-center space-y-6">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold block mb-2">
          Запитання {index + 1} з {total}
        </span>
        <h2 className="text-xl font-extrabold text-[var(--text-main)]">
          {data.question}
        </h2>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={answered}
          placeholder="Введіть відповідь..."
          className="w-full text-center p-4 text-lg font-bold bg-[var(--bg-card-elevated)] border-2 border-[var(--border-color)] rounded-2xl focus:outline-none focus:border-[var(--accent-cta)] transition-colors"
          autoFocus
        />

        {answered && (
          <div
            className={`p-3 rounded-xl text-sm font-bold ${isCorrect ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/10 text-[var(--accent-error)]"}`}
          >
            {isCorrect
              ? "Правильно!"
              : `Помилка. Правильно: ${data.correctAnswer}`}
          </div>
        )}
      </Card>
      {!answered ? (
        <Button
          onClick={() => setAnswered(true)}
          disabled={!input.trim()}
          variant="primary"
          className="w-full"
        >
          Перевірити
        </Button>
      ) : (
        <Button
          onClick={() => onNext(isCorrect ? 1 : 0, input)}
          variant="primary"
          className="w-full"
        >
          {isRetry ? "До підсумків" : "Наступна частина"}
        </Button>
      )}
    </div>
  );
});
export const TestStep = ({
  unit,
  onComplete,
}: {
  unit: any;
  words: Word[];
  onComplete: (isRetry?: boolean) => void;
}) => {
  const testItems = useMemo(() => unit?.steps?.test || [], [unit]);
  const totalParts = testItems.length;

  const [currentPart, setCurrentPart] = useState(0);
  const [isRetryAttempt, setIsRetryAttempt] = useState(false);
  const [expandedError, setExpandedError] = useState<number | null>(null);
  const [results, setResults] = useState<
    Record<number, { score: number; input: string }>
  >({});

  const handleNext = (partIndex: number, score: number, input: string) => {
    setResults((prev) => ({ ...prev, [partIndex]: { score, input } }));
    setCurrentPart(isRetryAttempt ? totalParts : partIndex + 1);
  };

  if (totalParts === 0)
    return (
      <div className="p-6 text-center text-[var(--text-muted)]">
        Тест не знайдено.
      </div>
    );

  if (currentPart >= totalParts) {
    const totalCorrect = Object.values(results).reduce(
      (acc, curr) => acc + curr.score,
      0,
    );
    const passThreshold = Math.ceil(totalParts * 0.7);
    const isPassed = totalCorrect >= passThreshold;

    return (
      <div className="space-y-4 my-auto w-full pb-6">
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
              Підсумок тесту
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              {totalCorrect} з {totalParts} правильно
            </p>
          </div>
          <div className="space-y-3 text-left w-full pt-4">
            {testItems.map((item: any, index: number) => {
              const res = results[index] || { score: 0, input: "Пропущено" };
              return (
                <div
                  key={index}
                  className={`flex flex-col p-3 bg-[var(--bg-card-elevated)] rounded-xl border transition-colors ${expandedError === index ? "border-[var(--accent-error)]" : "border-[var(--border-color)]"}`}
                >
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() =>
                      res.score === 0
                        ? setExpandedError(
                            expandedError === index ? null : index,
                          )
                        : null
                    }
                  >
                    <span className="font-medium text-sm text-[var(--text-main)] truncate max-w-[70%]">
                      {item.type === "sentence-scramble"
                        ? "Побудова речення"
                        : item.question}
                    </span>
                    {res.score === 1 ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-success)]">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-error)] bg-[var(--accent-error)]/10 px-2 py-1 rounded-lg">
                        <XCircle className="w-4 h-4" /> Помилка{" "}
                        {expandedError === index ? (
                          <ChevronUp className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1" />
                        )}
                      </span>
                    )}
                  </div>
                  {res.score === 0 && expandedError === index && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-sm animate-in slide-in-from-top-2">
                      <span className="text-red-400 block line-through mb-1">
                        Ви обрали: {res.input}
                      </span>
                      <span className="text-emerald-500 font-bold block mb-2">
                        Правильно: {item.correctAnswer || item.sentence}
                      </span>
                      <span className="text-[var(--text-muted)] text-xs italic block">
                        {item.explanation}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3 h-9 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsRetryAttempt(true);
                          setExpandedError(null);
                          setCurrentPart(index);
                        }}
                      >
                        <RotateCcw className="w-3 h-3 mr-1.5" /> Перескласти
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
        <Button
          onClick={() => onComplete(isRetryAttempt)}
          disabled={!isPassed}
          variant={isPassed ? "primary" : "secondary"}
          className="w-full h-14 text-lg mt-2"
        >
          {isPassed
            ? "Завершити юніт"
            : `Потрібно ${passThreshold} правильних відповідей`}
        </Button>
      </div>
    );
  }

  const currentItem = testItems[currentPart];
  const progressPercent = (currentPart / totalParts) * 100;

  return (
    <div className="space-y-4 my-auto w-full">
      <ProgressBar progress={progressPercent} />
      <div className="text-center text-[10px] font-black text-[var(--text-muted)] tracking-wider">
        ЗАВДАННЯ {currentPart + 1} З {totalParts}{" "}
        {isRetryAttempt && (
          <span className="text-[var(--accent-error)] ml-1">(ПОВТОР)</span>
        )}
      </div>

      {(currentItem.type === "quiz" ||
        currentItem.type === "grammar" ||
        currentItem.type === "reading") && (
        <QuizView
          key={`quiz-${currentPart}-${isRetryAttempt}`}
          data={currentItem}
          index={currentPart}
          total={totalParts}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(currentPart, s, i)}
        />
      )}

      {currentItem.type === "sentence-scramble" && (
        <ScrambleView
          key={`scramble-${currentPart}-${isRetryAttempt}`}
          data={currentItem}
          index={currentPart}
          total={totalParts}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(currentPart, s, i)}
        />
      )}

      {currentItem.type === "type-answer" && (
        <TypeAnswerView
          key={`typeanswer-${currentPart}-${isRetryAttempt}`}
          data={currentItem}
          index={currentPart}
          total={totalParts}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(currentPart, s, i)}
        />
      )}

      {/* ДОДАТИ ЦЕ: Захист від галюцинацій ШІ (невідомих типів) */}
      {![
        "quiz",
        "grammar",
        "reading",
        "sentence-scramble",
        "type-answer",
      ].includes(currentItem.type) && (
        <div className="p-6 mt-4 text-center bg-[var(--accent-error)]/10 border-2 border-[var(--accent-error)] rounded-2xl animate-in fade-in">
          <span className="text-[var(--accent-error)] font-bold text-lg">
            Помилка генерації
          </span>
          <p className="text-[var(--text-main)] mt-2 text-sm">
            ШІ згенерував невідомий тип питання:{" "}
            <b>{currentItem.type || "відсутній"}</b>.
          </p>
          <Button
            onClick={() =>
              handleNext(currentPart, 0, "Пропущено через помилку ШІ")
            }
            variant="primary"
            className="w-full mt-4 bg-[var(--accent-error)] hover:bg-red-600"
          >
            Пропустити запитання
          </Button>
        </div>
      )}
    </div>
  );
};
