import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { shuffle } from "../../shared/lib/shuffle";
import type { GameProps } from "../types";
import {
  WORDS_BY_LEVEL,
  WORD_LEVELS,
  pickRandomWords,
  type WordEntry,
  type WordLevel,
} from "../words";

type GameStatus = "setup" | "playing" | "gameover";
type TimeOption = 60 | 90 | 120;

const PAIRS = 6;
const PREVIEW_MS = 2000;
const TIME_OPTIONS: TimeOption[] = [60, 90, 120];

interface CardData {
  pairId: string;
  text: string;
  lang: "en" | "ua";
}

interface CardState {
  data: CardData;
  isFlipped: boolean;
  isMatched: boolean;
}

const buildDeck = (picked: WordEntry[]): CardState[] => {
  const cards: CardData[] = [];
  picked.forEach((w) => {
    cards.push({ pairId: w.word, text: w.word, lang: "en" });
    cards.push({ pairId: w.word, text: w.translation, lang: "ua" });
  });
  return shuffle(cards).map((c) => ({
    data: c,
    isFlipped: true,
    isMatched: false,
  }));
};

export const MemoryMatchGame = ({ onFinish }: GameProps) => {
  const [status, setStatus] = useState<GameStatus>("setup");
  const [level, setLevel] = useState<WordLevel>("A1");
  const [timeLimit, setTimeLimit] = useState<TimeOption>(60);

  const [cards, setCards] = useState<CardState[]>([]);
  const [roundWords, setRoundWords] = useState<WordEntry[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState(0);
  const [moves, setMoves] = useState(0);
  const [learned, setLearned] = useState<string[]>([]);

  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [isRecord, setIsRecord] = useState(false);
  const [best, setBest] = useState(0);
  const [isPreview, setIsPreview] = useState(false);

  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const matchedRef = useRef(0);

  const bestKey = `memory-match-best:${level}:${timeLimit}`;

  useEffect(() => {
    matchedRef.current = matched;
  }, [matched]);

  useEffect(() => {
    const stored = localStorage.getItem(bestKey);
    setBest(stored ? parseInt(stored, 10) || 0 : 0);
  }, [bestKey]);

  const missed = useMemo(
    () => roundWords.filter((w) => !learned.includes(w.word)),
    [roundWords, learned],
  );

  const finish = useCallback(
    (finalScore: number, didWin: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      lockRef.current = true;

      setScore(finalScore);
      setWon(didWin);
      setFinishedAt(Date.now());

      // Розкриваємо всі картки — навіть при поразці, щоб гравець бачив,
      // що саме було на полі.
      setCards((prev) => prev.map((c) => ({ ...c, isFlipped: true })));

      setStatus("gameover");

      const prevBest = parseInt(localStorage.getItem(bestKey) || "0", 10);
      if (finalScore > prevBest) {
        localStorage.setItem(bestKey, String(finalScore));
        setBest(finalScore);
        setIsRecord(true);
      } else {
        setIsRecord(false);
      }
    },
    [bestKey],
  );

  /* ------------------------- Timer ------------------------- */
  useEffect(() => {
    if (status !== "playing" || startedAt === 0) return;

    const tick = () => {
      const remain = Math.max(0, timeLimit * 1000 - (Date.now() - startedAt));
      setRemainingMs(remain);
      if (remain <= 0 && !finishedRef.current) {
        // Поразка: очки тільки за вже знайдені пари
        finish(matchedRef.current * 100, false);
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [status, startedAt, timeLimit, finish]);

  /* ------------------------ Win check ----------------------- */
  useEffect(() => {
    if (status !== "playing" || startedAt === 0) return;
    if (matched < PAIRS) return;
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const finalScore = matched * 100 + Math.max(0, timeLimit - elapsedSec) * 3;
    finish(finalScore, true);
  }, [matched, status, startedAt, timeLimit, finish]);

  /* ----------------------- Card click ----------------------- */
  const handleCardClick = useCallback(
    (idx: number) => {
      if (lockRef.current) return;
      if (status !== "playing") return;
      if (finishedRef.current) return;

      setCards((prev) => {
        const card = prev[idx];
        if (!card || card.isFlipped || card.isMatched) return prev;
        if (flipped.length >= 2) return prev;

        const nextFlipped = [...flipped, idx];
        const nextCards = prev.map((c, i) =>
          i === idx ? { ...c, isFlipped: true } : c,
        );

        if (nextFlipped.length === 2) {
          lockRef.current = true;
          setMoves((m) => m + 1);

          const [a, b] = nextFlipped;
          const isMatch = prev[a].data.pairId === prev[b].data.pairId;
          const delay = isMatch ? 350 : 1000;

          window.setTimeout(() => {
            // Якщо гру вже завершено — не чіпаємо картки (вони вже відкриті)
            if (finishedRef.current) return;

            setCards((current) =>
              current.map((c, i) => {
                if (i !== a && i !== b) return c;
                if (isMatch) return { ...c, isMatched: true };
                return { ...c, isFlipped: false };
              }),
            );
            setFlipped([]);
            lockRef.current = false;

            if (isMatch) {
              const word = prev[a].data.pairId;
              setMatched((m) => m + 1);
              setLearned((prevL) =>
                prevL.includes(word) ? prevL : [...prevL, word],
              );
            }
          }, delay);
        }

        setFlipped(nextFlipped);
        return nextCards;
      });
    },
    [flipped, status],
  );

  /* ----------------------- Start game ----------------------- */
  const startGame = useCallback(() => {
    const picked = pickRandomWords(level, PAIRS);
    const deck = buildDeck(picked);

    setRoundWords(picked);
    setCards(deck);
    setFlipped([]);
    setMatched(0);
    setMoves(0);
    setLearned([]);
    setScore(0);
    setWon(false);
    setIsRecord(false);
    setFinishedAt(0);
    setStartedAt(0);
    setRemainingMs(timeLimit * 1000);
    finishedRef.current = false;
    matchedRef.current = 0;
    lockRef.current = true;
    setIsPreview(true);
    setStatus("playing");

    window.setTimeout(() => {
      setCards((prev) => prev.map((c) => ({ ...c, isFlipped: false })));
      lockRef.current = false;
      setIsPreview(false);
      setStartedAt(Date.now());
    }, PREVIEW_MS);
  }, [level, timeLimit]);

  const progressPct = useMemo(() => {
    return Math.max(0, Math.min(100, (remainingMs / (timeLimit * 1000)) * 100));
  }, [remainingMs, timeLimit]);

  const progressColor =
    progressPct > 50
      ? "bg-emerald-500"
      : progressPct > 25
        ? "bg-yellow-500"
        : "bg-red-500";

  /* ------------------------------- Setup ------------------------------- */
  if (status === "setup") {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <Card className="!p-6 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-indigo-400" />
            <h1 className="text-2xl font-black text-[var(--text-main)]">
              Матриця Пам'яті
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Знайди пари: англійське слово та його переклад. Менше ходів і більше
            часу — більше очок.
          </p>
        </Card>

        <Card className="!p-5 mb-4">
          <p className="font-bold mb-3 text-[var(--text-main)]">Рівень слів</p>
          <div className="grid grid-cols-3 gap-2">
            {WORD_LEVELS.map((lvl) => (
              <Button
                key={lvl}
                variant={level === lvl ? "primary" : "secondary"}
                size="sm"
                onClick={() => setLevel(lvl)}
              >
                {lvl}
              </Button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            У базі: {WORDS_BY_LEVEL[level].length} слів
          </p>
        </Card>

        <Card className="!p-5 mb-4">
          <p className="font-bold mb-3 text-[var(--text-main)]">Час на гру</p>
          <div className="grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map((t) => (
              <Button
                key={t}
                variant={timeLimit === t ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTimeLimit(t)}
              >
                {t} с
              </Button>
            ))}
          </div>
        </Card>

        {best > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-[var(--text-muted)]">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Рекорд: <span className="font-bold">{best}</span>
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button size="lg" className="w-full" onClick={startGame}>
            <Play className="w-5 h-5 mr-2" />
            Почати гру
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Game over ------------------------------ */
  if (status === "gameover") {
    const durationSec = Math.max(
      1,
      Math.round((finishedAt - startedAt) / 1000),
    );
    const accuracy = moves === 0 ? 0 : Math.round((matched / moves) * 100);

    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <div className="flex flex-col items-center justify-center pt-6 pb-4 space-y-3">
          <Brain
            className={`w-16 h-16 ${
              won ? "text-emerald-400" : "text-indigo-400"
            }`}
          />
          <h2 className="text-3xl font-black text-[var(--text-main)]">
            {won ? "Перемога!" : "Час вичерпано"}
          </h2>
          {isRecord && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold text-sm">
              <Trophy className="w-4 h-4" /> NEW RECORD!
            </div>
          )}
        </div>

        <Card className="!p-5 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Рахунок" value={score} />
            <Stat label="Точність" value={`${accuracy}%`} />
            <Stat label="Пар знайдено" value={`${matched}/${PAIRS}`} />
            <Stat label="Час" value={`${durationSec} с`} />
          </div>
        </Card>

        {learned.length > 0 && (
          <Card className="!p-5 mb-4">
            <p className="font-bold mb-3 text-[var(--text-main)]">
              {won ? "Вивчені слова" : "Знайдені слова"} ({learned.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {learned.map((w) => (
                <span
                  key={w}
                  className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-sm font-bold border border-emerald-500/40"
                >
                  {w}
                </span>
              ))}
            </div>
          </Card>
        )}

        {!won && missed.length > 0 && (
          <Card className="!p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="font-bold text-[var(--text-main)]">
                Пропущені слова ({missed.length})
              </p>
            </div>
            <ul className="space-y-2">
              {missed.map((w) => (
                <li
                  key={w.word}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-bold text-[var(--text-main)]">
                    {w.word}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {w.translation}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              Повтори ці слова перед наступною спробою.
            </p>
          </Card>
        )}

        <div className="mt-auto w-full space-y-3 pt-2">
          <Button onClick={startGame} className="w-full py-4 text-lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            {won ? "Грати ще" : "Спробувати ще"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStatus("setup")}
            className="w-full py-4 text-lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Змінити налаштування
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              onFinish({
                score,
                wordsLearned: learned,
                moves,
                timeMs: Math.max(0, finishedAt - startedAt),
              })
            }
            className="w-full"
          >
            Вийти
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------- Playing ------------------------------- */
  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full">
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-1.5 text-indigo-400">
          <Brain className="w-5 h-5" />
          <span className="font-bold text-sm">
            {matched}/{PAIRS}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isPreview && (
            <span className="text-xs font-bold text-yellow-400 animate-pulse">
              Запам'ятай...
            </span>
          )}
          <span className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
            <Clock className="w-4 h-4" />
            {Math.ceil(remainingMs / 1000)} с
          </span>
          <span className="text-xl font-black text-[var(--text-main)]">
            {score}
          </span>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden mb-4">
        <div
          className={`h-full ${progressColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 flex-1 content-start">
        {cards.map((c, idx) => {
          const isFaceUp = c.isFlipped || c.isMatched;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCardClick(idx)}
              disabled={c.isMatched || c.isFlipped || isPreview}
              className="relative w-full aspect-square [perspective:800px] disabled:cursor-default"
            >
              <div
                className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
                style={{
                  transform: isFaceUp ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 border-2 border-indigo-300 shadow-lg flex items-center justify-center [backface-visibility:hidden]">
                  <span className="text-3xl sm:text-4xl">🎴</span>
                </div>

                <div
                  className={`absolute inset-0 rounded-2xl flex items-center justify-center p-1.5 text-center font-black [backface-visibility:hidden] transition-colors ${
                    c.isMatched
                      ? "bg-emerald-500 border-2 border-emerald-300 text-white shadow-[0_0_18px_rgba(16,185,129,0.65)]"
                      : "bg-[var(--bg-card-elevated)] border-2 border-[var(--border-color)] text-[var(--text-main)]"
                  }`}
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <span className="text-xs sm:text-sm leading-tight break-words">
                    {c.data.text}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col">
    <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] font-bold">
      {label}
    </span>
    <span className="text-2xl font-black text-[var(--text-main)]">{value}</span>
  </div>
);
