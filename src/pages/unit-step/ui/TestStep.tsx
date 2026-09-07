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
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock"; // Перевір шлях до shared/ui
import type { Word } from "../../../entities/word/types";

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// ================= ІЗОЛЬОВАНІ КОМПОНЕНТИ ЧАСТИН (Без зайвих ре-рендерів) =================

const Part1View = memo(({ data, onNext, isRetry }: any) => {
  const [answered, setAnswered] = useState(false);
  const [input, setInput] = useState("");

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 text-center">
        <h2 className="text-xl font-extrabold text-[var(--text-main)]">
          {data.question}
        </h2>
      </Card>
      <div className="space-y-2">
        {data.options.map((opt: string, i: number) => {
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

const Part2View = memo(({ data, onNext, isRetry }: any) => {
  const [input, setInput] = useState("");
  const [answered, setAnswered] = useState(false);
  const isCorrect = input.trim().toLowerCase() === data.answer;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 space-y-4 text-center">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold">
          Вставте пропущене слово
        </span>
        <p className="text-xl font-semibold text-[var(--text-main)] leading-loose">
          {data.sentence
            .split("___")
            .map((part: string, i: number, arr: string[]) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={answered}
                    className="mx-2 w-24 border-b-2 border-[var(--accent-cta)] bg-[var(--bg-card-elevated)] rounded-t-md text-center text-[var(--accent-cta)] font-bold focus:outline-none focus:bg-[var(--bg-card-hover)] px-2 py-1"
                  />
                )}
              </span>
            ))}
        </p>
        {answered && (
          <div
            className={`p-3 rounded-xl text-sm font-bold mt-2 ${isCorrect ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/10 text-[var(--accent-error)]"}`}
          >
            {isCorrect
              ? "Правильно!"
              : `Помилка. Правильна відповідь: ${data.answer}`}
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

const Part3View = memo(({ data, onNext, isRetry }: any) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(data.shuffled);
  const [answered, setAnswered] = useState(false);
  const isCorrect =
    selected.join(" ").toLowerCase() === data.words.join(" ").toLowerCase();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <Card className="p-6 space-y-6 text-center">
        <span className="text-xs text-[var(--text-muted)] uppercase font-semibold block mb-2">
          Складіть речення
        </span>
        {data.translation && (
          <p className="text-lg font-bold text-[var(--text-main)] italic opacity-90 pb-2">
            "{data.translation}"
          </p>
        )}
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
            {isCorrect ? "Правильно!" : `Помилка. Правильно: ${data.original}`}
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

// ================= ГОЛОВНИЙ КОМПОНЕНТ =================

export const TestStep = ({
  unit,
  words,
  onComplete,
}: {
  unit: any;
  words: Word[];
  onComplete: (isRetry?: boolean) => void;
}) => {
  const [currentPart, setCurrentPart] = useState(1);
  const [isRetryAttempt, setIsRetryAttempt] = useState(false);
  const [expandedError, setExpandedError] = useState<number | null>(null);
  const [results, setResults] = useState<
    Record<number, { score: number; input: string }>
  >({
    1: { score: 0, input: "" },
    2: { score: 0, input: "" },
    3: { score: 0, input: "" },
    4: { score: 0, input: "" },
  });

  // ДОДАЙ ЦЕЙ РЯДОК:
  const [part4Passed, setPart4Passed] = useState(false);

  // Дані генеруються один раз завдяки [unit?.id]
  const part1Data = useMemo(() => {
    const t = (unit?.steps?.test || unit?.test || [])[0];
    if (t)
      return {
        question: t.question,
        options: shuffleArray([...t.options]),
        correctAnswer: t.options[t.correctAnswer],
        explanation: t.explanation,
      };
    const w = words[0];
    if (!w) return null;
    return {
      question: `Обери правильний переклад: '${w.text}'`,
      options: shuffleArray([
        w.translation,
        ...shuffleArray(
          words.filter((x) => x.id !== w.id).map((x) => x.translation),
        ).slice(0, 3),
      ]),
      correctAnswer: w.translation,
      explanation: `'${w.text}' означає '${w.translation}'`,
    };
  }, [unit?.id, words]);

  const part2Data = useMemo(() => {
    const eg = (
      unit?.steps?.grammar?.examples ||
      unit?.grammar?.examples ||
      []
    ).find((e: any) => e.en.includes("**"));
    if (eg) {
      const match = eg.en.match(/\*\*(.*?)\*\*/);
      return {
        sentence: eg.en.replace(/\*\*(.*?)\*\*/, "___"),
        answer: (match ? match[1] : "is").toLowerCase(),
        ua: eg.ua,
        original: eg.en.replace(/\*\*/g, ""),
      };
    }
    return {
      sentence: "I ___ learning English.",
      answer: "am",
      ua: "Я вивчаю англійську.",
      original: "I am learning English.",
    };
  }, [unit?.id]);

  const part3Data = useMemo(() => {
    let sentence = "I like to learn English";
    let translation = "Мені подобається вивчати англійську";
    const gEx = unit?.steps?.grammar?.examples || [];
    if (gEx.length > 0) {
      sentence = gEx[0].en.replace(/\*\*/g, "");
      translation = gEx[0].ua.replace(/\*\*/g, "");
    } else if (words[0]?.exampleSentence) {
      sentence = words[0].exampleSentence;
      translation = words[0].exampleTranslation || "";
    }
    const parts = sentence
      .replace(/[.!?,"']/g, "")
      .trim()
      .split(" ")
      .filter(Boolean);
    return {
      original: sentence,
      translation,
      words: parts,
      shuffled: shuffleArray([...parts]),
    };
  }, [unit?.id, words]);

  const part4Data = useMemo(() => {
    const lines = unit?.steps?.speaking?.lines || [];
    return lines.length > 0
      ? lines[lines.length - 1].text
      : words[0]?.exampleSentence || "Hello!";
  }, [unit?.id, words]);

  const handleNext = (partId: number, score: number, input: string) => {
    setResults((prev) => ({ ...prev, [partId]: { score, input } }));
    setCurrentPart(isRetryAttempt ? 5 : partId + 1);
  };

  if (currentPart === 5) {
    const totalCorrect = Object.values(results).reduce(
      (acc, curr) => acc + curr.score,
      0,
    );
    const isPassed = totalCorrect >= 3;

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
          </div>
          <div className="space-y-3 text-left w-full pt-4">
            {[
              {
                id: 1,
                label: "1. Теорія",
                val: results[1].score,
                details: (
                  <>
                    <span className="text-red-400 block line-through">
                      Ви обрали: {results[1].input}
                    </span>
                    <span className="text-emerald-500 font-bold block mt-1">
                      Правильно: {part1Data?.correctAnswer}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs block mt-2 italic">
                      {part1Data?.explanation}
                    </span>
                  </>
                ),
              },
              {
                id: 2,
                label: "2. Граматика",
                val: results[2].score,
                details: (
                  <>
                    <span className="text-[var(--text-muted)] italic block mb-1">
                      "{part2Data.ua}"
                    </span>
                    <span className="text-red-400 block line-through">
                      Ваша відповідь: {results[2].input}
                    </span>
                    <span className="text-emerald-500 font-bold block mt-1">
                      Правильно: {part2Data.original}
                    </span>
                  </>
                ),
              },
              {
                id: 3,
                label: "3. Побудова",
                val: results[3].score,
                details: (
                  <>
                    <span className="text-red-400 block line-through mb-1">
                      Ви зібрали: {results[3].input}
                    </span>
                    <span className="text-emerald-500 font-bold block">
                      Правильно: {part3Data.original}
                    </span>
                  </>
                ),
              },
              {
                id: 4,
                label: "4. Вимова",
                val: results[4].score,
                details: (
                  <span className="text-[var(--text-muted)]">
                    Не вдалося розпізнати.
                  </span>
                ),
              },
            ].map((res) => (
              <div
                key={res.id}
                className={`flex flex-col p-3 bg-[var(--bg-card-elevated)] rounded-xl border transition-colors ${expandedError === res.id ? "border-[var(--accent-error)]" : "border-[var(--border-color)]"}`}
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() =>
                    res.val === 0
                      ? setExpandedError(
                          expandedError === res.id ? null : res.id,
                        )
                      : null
                  }
                >
                  <span className="font-medium text-sm text-[var(--text-main)]">
                    {res.label}
                  </span>
                  {res.val === 1 ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-success)]">
                      <CheckCircle2 className="w-4 h-4" /> Успіх
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-error)] bg-[var(--accent-error)]/10 px-2 py-1 rounded-lg">
                      <XCircle className="w-4 h-4" /> Помилка{" "}
                      {expandedError === res.id ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </span>
                  )}
                </div>
                {res.val === 0 && expandedError === res.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-sm animate-in slide-in-from-top-2">
                    {res.details}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 h-9 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRetryAttempt(true);
                        setExpandedError(null);
                        setCurrentPart(res.id);
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1.5" /> Перескласти
                      частину {res.id}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
        {isPassed && (
          <Button
            onClick={() => onComplete(isRetryAttempt)}
            variant="primary"
            className="w-full h-14 text-lg mt-2"
          >
            Завершити юніт
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 my-auto w-full">
      <ProgressBar progress={(currentPart / 4) * 100} />
      <div className="text-center text-[10px] font-black text-[var(--text-muted)] tracking-wider">
        ЧАСТИНА {currentPart} З 4{" "}
        {isRetryAttempt && (
          <span className="text-[var(--accent-error)] ml-1">(ПОВТОР)</span>
        )}
      </div>

      {currentPart === 1 && (
        <Part1View
          key={`p1-${isRetryAttempt}`}
          data={part1Data}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(1, s, i)}
        />
      )}
      {currentPart === 2 && (
        <Part2View
          key={`p2-${isRetryAttempt}`}
          data={part2Data}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(2, s, i)}
        />
      )}
      {currentPart === 3 && (
        <Part3View
          key={`p3-${isRetryAttempt}`}
          data={part3Data}
          isRetry={isRetryAttempt}
          onNext={(s: number, i: string) => handleNext(3, s, i)}
        />
      )}

      {currentPart === 4 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <SpeechPracticeBlock
            targetText={part4Data}
            onStatusChange={(canProceed: boolean) => setPart4Passed(canProceed)}
            threshold={70}
            maxAttempts={3}
          />
          <Button
            onClick={() => handleNext(4, part4Passed ? 1 : 0, "")}
            variant="primary"
            className="w-full"
          >
            Показати результати
          </Button>
        </div>
      )}
    </div>
  );
};
