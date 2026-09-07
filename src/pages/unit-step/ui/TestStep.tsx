// src/pages/unit-step/ui/TestStep.tsx
import { useState, useMemo } from "react";
import { Trophy, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock";
import type { Word } from "../../../entities/word/types";

// Алгоритм Тасовання
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const TestStep = ({
  unit,
  words,
  onComplete,
}: {
  unit: any; // Використовуємо any або Unit, якщо тип вже оновлено
  words: Word[];
  onComplete: () => void;
}) => {
  const [currentPart, setCurrentPart] = useState(1);
  const [scores, setScores] = useState({
    part1: 0,
    part2: 0,
    part3: 0,
    part4: 0,
  }); // 1 - успіх, 0 - провал

  // ================= ДАНІ ДЛЯ КОЖНОЇ ЧАСТИНИ =================

  // Частина 1: Тест (із контенту unit.test або фоллбек на слова)
  const part1Data = useMemo(() => {
    const testArr = unit?.steps?.test || unit?.test || [];
    if (testArr.length > 0) {
      const t = testArr[0];
      return {
        question: t.question,
        options: shuffleArray([...t.options]),
        correctAnswer: t.options[t.correctAnswer],
      };
    }
    const w = words[0];
    if (!w) return null;
    const otherOptions = shuffleArray(
      words.filter((x) => x.id !== w.id).map((x) => x.translation),
    ).slice(0, 3);
    return {
      question: `Обери правильний переклад: '${w.text}'`,
      options: shuffleArray([w.translation, ...otherOptions]),
      correctAnswer: w.translation,
    };
  }, [unit, words]);

  // Частина 2: Граматика (шукаємо речення з **слово**)
  const part2Data = useMemo(() => {
    const examples =
      unit?.steps?.grammar?.examples || unit?.grammar?.examples || [];
    const eg = examples.find((e: any) => e.en.includes("**"));
    if (eg) {
      const match = eg.en.match(/\*\*(.*?)\*\*/);
      const answer = match ? match[1] : "is";
      return {
        sentence: eg.en.replace(/\*\*(.*?)\*\*/, "___"),
        answer: answer.toLowerCase(),
        ua: eg.ua,
      };
    }
    return {
      sentence: "I ___ learning English.",
      answer: "am",
      ua: "Я вивчаю англійську.",
    };
  }, [unit]);

  // Частина 3: Scramble (перемішані слова з будь-якого речення юніту)
  const part3Data = useMemo(() => {
    // Беремо речення з граматики або читання
    let sentence = "I like to learn English";
    let translation = "Мені подобається вивчати англійську";

    const readingText = unit?.steps?.reading?.text || unit?.readingText;
    const readingTranslation =
      unit?.steps?.reading?.translation || unit?.readingTranslation;
    const grammarExamples = unit?.steps?.grammar?.examples || [];

    if (grammarExamples.length > 0) {
      sentence = grammarExamples[0].en.replace(/\*\*/g, ""); // Видаляємо зірочки підсвітки
      translation = grammarExamples[0].ua.replace(/\*\*/g, "");
    } else if (readingText) {
      const match = readingText.match(/[^.!?]+[.!?]+/);
      if (match) sentence = match[0];
      if (readingTranslation) {
        const matchUa = readingTranslation.match(/[^.!?]+[.!?]+/);
        if (matchUa) translation = matchUa[0];
      }
    } else if (words[0]?.exampleSentence) {
      sentence = words[0].exampleSentence;
      translation = words[0].exampleTranslation || "";
    }

    const cleanSentence = sentence.replace(/[.!?,"']/g, "").trim();
    const parts = cleanSentence.split(" ").filter(Boolean);
    return {
      original: sentence,
      translation: translation,
      words: parts,
      shuffled: shuffleArray([...parts]),
    };
  }, [unit, words]);

  // Частина 4: Вимова
  const part4Data = useMemo(() => {
    const lines = unit?.steps?.speaking?.lines || [];
    if (lines.length > 0) return lines[lines.length - 1].text;
    return words[0]?.exampleSentence || "Hello!";
  }, [unit, words]);

  // ================= СТАНИ ДЛЯ UI =================
  const [part1Answered, setPart1Answered] = useState(false);
  const [part2Input, setPart2Input] = useState("");
  const [part2Answered, setPart2Answered] = useState(false);
  const [part2Correct, setPart2Correct] = useState(false);

  const [scrambleSelected, setScrambleSelected] = useState<string[]>([]);
  const [scrambleAvailable, setScrambleAvailable] = useState<string[]>(
    part3Data.shuffled,
  );
  const [part3Answered, setPart3Answered] = useState(false);
  const [part3Correct, setPart3Correct] = useState(false);

  const [part4Passed, setPart4Passed] = useState(false);

  // ================= ОБРОБНИКИ =================

  const handlePart2Submit = () => {
    const isCorrect = part2Input.trim().toLowerCase() === part2Data.answer;
    setPart2Correct(isCorrect);
    setPart2Answered(true);
    setScores((s) => ({ ...s, part2: isCorrect ? 1 : 0 }));
  };

  const handleSelectWord = (word: string, idx: number) => {
    setScrambleAvailable((prev) => prev.filter((_, i) => i !== idx));
    setScrambleSelected((prev) => [...prev, word]);
  };

  const handleDeselectWord = (word: string, idx: number) => {
    setScrambleSelected((prev) => prev.filter((_, i) => i !== idx));
    setScrambleAvailable((prev) => [...prev, word]);
  };

  const handlePart3Check = () => {
    const isCorrect =
      scrambleSelected.join(" ").toLowerCase() ===
      part3Data.words.join(" ").toLowerCase();
    setPart3Correct(isCorrect);
    setPart3Answered(true);
    setScores((s) => ({ ...s, part3: isCorrect ? 1 : 0 }));
  };

  // ================= РЕНДЕР ПІДСУМКУ =================
  if (currentPart === 5) {
    const totalCorrect = Object.values(scores).reduce((a, b) => a + b, 0);
    const isPassed = totalCorrect >= 3; // 3 з 4 частин

    return (
      <div className="space-y-4 my-auto w-full">
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
            <p className="text-sm font-semibold text-[var(--text-main)] mt-1">
              {isPassed ? "Чудова робота!" : "Варто повторити матеріал"}
            </p>
          </div>

          <div className="space-y-2 text-left w-full pt-4">
            {[
              { label: "1. Теорія", val: scores.part1 },
              { label: "2. Граматика", val: scores.part2 },
              { label: "3. Побудова", val: scores.part3 },
              { label: "4. Вимова", val: scores.part4 },
            ].map((res, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 bg-[var(--bg-card-elevated)] rounded-xl border border-[var(--border-color)]"
              >
                <span className="font-medium text-sm text-[var(--text-main)]">
                  {res.label}
                </span>
                {res.val === 1 ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-success)]">
                    <CheckCircle2 className="w-4 h-4" /> Успіх
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-[var(--accent-error)]">
                    <XCircle className="w-4 h-4" /> Помилка
                  </span>
                )}
              </div>
            ))}
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
              // Скидаємо тест
              setScores({ part1: 0, part2: 0, part3: 0, part4: 0 });
              setPart1Answered(false);
              setPart2Answered(false);
              setPart3Answered(false);
              setPart4Passed(false);
              setPart2Input("");
              setScrambleSelected([]);
              setScrambleAvailable(part3Data.shuffled);
              setCurrentPart(1);
            }}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Пройти знову
          </Button>
        )}
      </div>
    );
  }

  // ================= РЕНДЕР ПРОЦЕСУ =================
  return (
    <div className="space-y-4 my-auto w-full">
      <ProgressBar progress={(currentPart / 4) * 100} />
      <div className="text-center text-[10px] font-black text-[var(--text-muted)] tracking-wider">
        ЧАСТИНА {currentPart} З 4
      </div>

      {/* ЧАСТИНА 1: Тест із варіантами */}
      {currentPart === 1 && part1Data && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <Card className="p-6 text-center">
            <h2 className="text-xl font-extrabold text-[var(--text-main)]">
              {part1Data.question}
            </h2>
          </Card>
          <div className="space-y-2">
            {part1Data.options.map((opt, i) => {
              const isCorrectOpt = opt === part1Data.correctAnswer;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setPart1Answered(true);
                    setScores((s) => ({ ...s, part1: isCorrectOpt ? 1 : 0 }));
                  }}
                  disabled={part1Answered}
                  className={`w-full p-4 rounded-2xl font-semibold text-left border-2 transition-all flex justify-between items-center ${
                    part1Answered
                      ? isCorrectOpt
                        ? "bg-[var(--accent-success)]/10 border-[var(--accent-success)] text-[var(--accent-success)]"
                        : "bg-[var(--bg-card)] border-[var(--border-color)] opacity-50 text-[var(--text-muted)]"
                      : "bg-[var(--bg-card-hover)] border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--accent-cta)]"
                  }`}
                >
                  <span>{opt}</span>
                  {part1Answered && isCorrectOpt && (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </button>
              );
            })}
          </div>
          {part1Answered && (
            <Button
              onClick={() => setCurrentPart(2)}
              variant="primary"
              className="w-full mt-4"
            >
              Наступна частина
            </Button>
          )}
        </div>
      )}

      {/* ЧАСТИНА 2: Граматичний пропуск */}
      {currentPart === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <Card className="p-6 space-y-4 text-center">
            <span className="text-xs text-[var(--text-muted)] uppercase font-semibold">
              Вставте пропущене слово
            </span>
            <p className="text-xl font-semibold text-[var(--text-main)] leading-loose">
              {part2Data.sentence
                .split("___")
                .map((part: string, i: number, arr: string[]) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input
                        type="text"
                        value={part2Input}
                        onChange={(e) => setPart2Input(e.target.value)}
                        disabled={part2Answered}
                        className="mx-2 w-24 border-b-2 border-[var(--accent-cta)] bg-[var(--bg-card-elevated)] rounded-t-md text-center text-[var(--accent-cta)] font-bold focus:outline-none focus:bg-[var(--bg-card-hover)] px-2 py-1"
                      />
                    )}
                  </span>
                ))}
            </p>
            {part2Answered && (
              <div
                className={`p-3 rounded-xl text-sm font-bold mt-2 ${part2Correct ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/10 text-[var(--accent-error)]"}`}
              >
                {part2Correct
                  ? "Правильно!"
                  : `Помилка. Правильна відповідь: ${part2Data.answer}`}
              </div>
            )}
          </Card>
          {!part2Answered ? (
            <Button
              onClick={handlePart2Submit}
              disabled={!part2Input.trim()}
              variant="primary"
              className="w-full"
            >
              Перевірити
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentPart(3)}
              variant="primary"
              className="w-full"
            >
              Наступна частина
            </Button>
          )}
        </div>
      )}

      {/* ЧАСТИНА 3: Scramble */}
      {currentPart === 3 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <Card className="p-6 space-y-6 text-center">
            <span className="text-xs text-[var(--text-muted)] uppercase font-semibold block mb-2">
              Складіть речення
            </span>

            {part3Data.translation && (
              <p className="text-lg font-bold text-[var(--text-main)] italic opacity-90 pb-2">
                "{part3Data.translation}"
              </p>
            )}

            <div className="flex flex-wrap gap-2 justify-center min-h-[4rem] p-4 bg-[var(--bg-card-elevated)] rounded-2xl border-2 border-[var(--border-color)]">
              {scrambleSelected.map((word, i) => (
                <Button
                  key={i}
                  variant="primary"
                  size="sm"
                  onClick={() => !part3Answered && handleDeselectWord(word, i)}
                  className="px-3 py-1.5"
                >
                  {word}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {scrambleAvailable.map((word, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  onClick={() => !part3Answered && handleSelectWord(word, i)}
                  className="px-3 py-1.5"
                >
                  {word}
                </Button>
              ))}
            </div>

            {part3Answered && (
              <div
                className={`p-3 rounded-xl text-sm font-bold ${part3Correct ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" : "bg-[var(--accent-error)]/10 text-[var(--accent-error)]"}`}
              >
                {part3Correct
                  ? "Правильно!"
                  : `Помилка. Правильно: ${part3Data.original}`}
              </div>
            )}
          </Card>
          {!part3Answered ? (
            <Button
              onClick={handlePart3Check}
              disabled={scrambleSelected.length === 0}
              variant="primary"
              className="w-full"
            >
              Перевірити
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentPart(4)}
              variant="primary"
              className="w-full"
            >
              Наступна частина
            </Button>
          )}
        </div>
      )}

      {/* ЧАСТИНА 4: Вимова */}
      {currentPart === 4 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <SpeechPracticeBlock
            targetText={part4Data}
            onStatusChange={(canProceed: boolean) => setPart4Passed(canProceed)}
            threshold={70}
            maxAttempts={3}
          />
          <Button
            onClick={() => {
              // Вважаємо вихід з блоку мікрофону завжди позитивним балом або 0 якщо скіп,
              // але для простоти SpeechPracticeBlock блокує "Далі" поки не пройдеш або не вичерпаєш спроби.
              setScores((s) => ({ ...s, part4: 1 }));
              setCurrentPart(5);
            }}
            variant="primary"
            className="w-full"
            disabled={!part4Passed}
          >
            Показати результати
          </Button>
        </div>
      )}
    </div>
  );
};
