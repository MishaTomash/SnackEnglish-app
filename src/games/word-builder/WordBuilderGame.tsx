import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eraser,
  Hammer,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
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
type Feedback = "idle" | "correct" | "wrong";

const ROUND_SIZE = 10;
const SOLVE_DELAY_MS = 800;
const WRONG_DELAY_MS = 1000;
const SCORE_PER_WORD = 100;
const MISS_PENALTY = 10;
const HINT_COST = 30;
const HINTS_PER_GAME = 3;

const KEYFRAMES = `
@keyframes wb-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(4px); }
}
@keyframes wb-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes wb-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

interface LetterTile {
  id: number;
  char: string;
}

const buildTiles = (word: string): LetterTile[] => {
  const base: LetterTile[] = word.split("").map((char, i) => ({ id: i, char }));

  let shuffled = shuffle(base);
  let tries = 0;
  const sameOrder = (arr: LetterTile[]) =>
    arr.every((t, i) => t.char === base[i].char);

  while (sameOrder(shuffled) && tries < 5) {
    shuffled = shuffle(base);
    tries++;
  }
  return shuffled;
};

export const WordBuilderGame = ({ onFinish }: GameProps) => {
  const [status, setStatus] = useState<GameStatus>("setup");
  const [level, setLevel] = useState<WordLevel>("A1");

  const [words, setWords] = useState<WordEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_GAME);

  const [score, setScore] = useState(0);
  const [learned, setLearned] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);

  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [best, setBest] = useState(0);
  const [isRecord, setIsRecord] = useState(false);

  const lockRef = useRef(false);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  const bestKey = `word-builder-best:${level}`;

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    const stored = localStorage.getItem(bestKey);
    setBest(stored ? parseInt(stored, 10) || 0 : 0);
  }, [bestKey]);

  const currentWord = words[currentIndex];

  /* --------------- rebuild tiles+slots on word change --------------- */
  useEffect(() => {
    if (status !== "playing" || !currentWord) return;
    setTiles(buildTiles(currentWord.word));
    setSlots(new Array(currentWord.word.length).fill(null));
    setFeedback("idle");
    lockRef.current = false;
  }, [currentIndex, currentWord, status]);

  /* --------------------- finish game helper --------------------- */
  const finishGame = useCallback(
    (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      lockRef.current = true;

      setFinishedAt(Date.now());
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

  /* -------------- central "validate word" helper -------------- */
  const tryPlace = useCallback(
    (nextSlots: (number | null)[]) => {
      setSlots(nextSlots);

      if (!currentWord) return;
      if (!nextSlots.every((s) => s !== null)) return;

      const target = currentWord.word;
      const built = nextSlots.map((s) => tiles[s as number].char).join("");

      lockRef.current = true;

      if (built === target) {
        setFeedback("correct");
        setScore((v) => v + SCORE_PER_WORD);
        setLearned((prev) =>
          prev.includes(target) ? prev : [...prev, target],
        );

        timeoutRef.current = window.setTimeout(() => {
          if (currentIndex + 1 >= words.length) {
            finishGame(scoreRef.current + SCORE_PER_WORD);
          } else {
            setCurrentIndex((i) => i + 1);
          }
        }, SOLVE_DELAY_MS);
      } else {
        setFeedback("wrong");
        setMistakes((m) => m + 1);
        setScore((v) => Math.max(0, v - MISS_PENALTY));

        timeoutRef.current = window.setTimeout(() => {
          // Залишаємо лише літери, що стоять на своїх позиціях
          const kept = nextSlots.map((s, i) =>
            tiles[s as number].char === target[i] ? s : null,
          );
          setSlots(kept);
          setFeedback("idle");
          lockRef.current = false;
        }, WRONG_DELAY_MS);
      }
    },
    [currentWord, tiles, currentIndex, words.length, finishGame],
  );

  /* ------------------------- letter click ------------------------ */
  const handleLetterClick = useCallback(
    (tileIdx: number) => {
      if (status !== "playing") return;
      if (lockRef.current || feedback !== "idle") return;
      if (!currentWord) return;
      if (slots.includes(tileIdx)) return;
      const emptyIdx = slots.indexOf(null);
      if (emptyIdx === -1) return;

      const next = slots.slice();
      next[emptyIdx] = tileIdx;
      tryPlace(next);
    },
    [status, feedback, currentWord, slots, tryPlace],
  );

  /* -------------------- click on filled slot -------------------- */
  const handleSlotClick = useCallback(
    (slotIdx: number) => {
      if (status !== "playing") return;
      if (lockRef.current || feedback !== "idle") return;
      if (slots[slotIdx] === null) return;

      const next = slots.slice();
      next[slotIdx] = null;
      setSlots(next);
    },
    [status, feedback, slots],
  );

  /* ---------------------------- undo --------------------------- */
  const handleUndo = useCallback(() => {
    if (status !== "playing") return;
    if (lockRef.current || feedback !== "idle") return;
    const lastFilled = [...slots]
      .map((s, i) => (s !== null ? i : -1))
      .filter((i) => i !== -1)
      .pop();
    if (lastFilled === undefined) return;
    const next = slots.slice();
    next[lastFilled] = null;
    setSlots(next);
  }, [status, feedback, slots]);

  /* ---------------------------- clear -------------------------- */
  const handleClear = useCallback(() => {
    if (status !== "playing") return;
    if (lockRef.current || feedback !== "idle") return;
    if (!currentWord) return;
    setSlots(new Array(currentWord.word.length).fill(null));
  }, [status, feedback, currentWord]);

  /* ---------------------------- hint --------------------------- */
  const handleHint = useCallback(() => {
    if (status !== "playing") return;
    if (lockRef.current || feedback !== "idle") return;
    if (!currentWord) return;
    if (hintsLeft <= 0) return;

    const target = currentWord.word;
    const emptyIdx = slots.indexOf(null);
    if (emptyIdx === -1) return;

    const needed = target[emptyIdx];
    const used = new Set(slots.filter((s): s is number => s !== null));
    const tileIdx = tiles.findIndex(
      (t, i) => !used.has(i) && t.char === needed,
    );
    if (tileIdx === -1) return;

    const next = slots.slice();
    next[emptyIdx] = tileIdx;

    setHintsLeft((h) => h - 1);
    setScore((v) => Math.max(0, v - HINT_COST));
    scoreRef.current = Math.max(0, scoreRef.current - HINT_COST);

    tryPlace(next);
  }, [status, feedback, currentWord, hintsLeft, slots, tiles, tryPlace]);

  /* --------------------------- start ---------------------------- */
  const startGame = useCallback(() => {
    const picked = pickRandomWords(level, ROUND_SIZE);
    setWords(picked);
    setCurrentIndex(0);
    setTiles([]);
    setSlots([]);
    setFeedback("idle");
    setHintsLeft(HINTS_PER_GAME);
    setScore(0);
    setLearned([]);
    setMistakes(0);
    setFinishedAt(0);
    setIsRecord(false);
    scoreRef.current = 0;
    finishedRef.current = false;
    lockRef.current = false;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setStartedAt(Date.now());
    setStatus("playing");
  }, [level]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  /* ----------------------- derived values ----------------------- */
  const progressPct = useMemo(() => {
    if (words.length === 0) return 0;
    return (
      ((currentIndex + (feedback === "correct" ? 1 : 0)) / words.length) * 100
    );
  }, [currentIndex, words.length, feedback]);

  const slotClass = (i: number): string => {
    if (feedback === "correct")
      return "bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.55)]";
    if (feedback === "wrong" && currentWord) {
      const s = slots[i];
      if (s === null) return "bg-red-500/10 border-red-400/50";
      const ok = tiles[s].char === currentWord.word[i];
      return ok
        ? "bg-emerald-500/25 border-emerald-400 text-emerald-100"
        : "bg-red-500/25 border-red-400 text-red-100";
    }
    return "bg-[var(--bg-card-elevated)] border-[var(--border-color)] text-[var(--text-main)]";
  };

  const boardAnimation =
    feedback === "wrong"
      ? "wb-shake 500ms ease-in-out"
      : feedback === "correct"
        ? "wb-pop 500ms ease-out"
        : "wb-fade-in 250ms ease-out";

  /* ------------------------------ Setup ------------------------------ */
  if (status === "setup") {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <style>{KEYFRAMES}</style>

        <Card className="!p-6 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Hammer className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl font-black text-[var(--text-main)]">
              Будівельник Слів
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Склади англійське слово з перемішаних літер, орієнтуючись на
            український переклад. 10 слів, 3 підказки — вперед!
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
    const totalAttempts = learned.length + mistakes;
    const accuracy =
      totalAttempts === 0
        ? 0
        : Math.round((learned.length / totalAttempts) * 100);

    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <style>{KEYFRAMES}</style>

        <div className="flex flex-col items-center justify-center pt-6 pb-4 space-y-3">
          <Hammer className="w-16 h-16 text-orange-400" />
          <h2 className="text-3xl font-black text-[var(--text-main)]">
            Гру завершено!
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
            <Stat label="Зібрано" value={`${learned.length}/${ROUND_SIZE}`} />
            <Stat label="Помилок" value={mistakes} />
            <Stat label="Час" value={`${durationSec} с`} />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Точність: {accuracy}%
          </p>
        </Card>

        {learned.length > 0 && (
          <Card className="!p-5 mb-4">
            <p className="font-bold mb-3 text-[var(--text-main)]">
              Вивчені слова ({learned.length})
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

        <div className="mt-auto w-full space-y-3 pt-2">
          <Button onClick={startGame} className="w-full py-4 text-lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            Грати ще
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
                moves: learned.length + mistakes,
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
  if (!currentWord) return null;

  const canInteract = !lockRef.current && feedback === "idle";
  const canHint = canInteract && hintsLeft > 0 && slots.includes(null);
  const canUndo = canInteract && slots.some((s) => s !== null);
  const canClear = canInteract && slots.some((s) => s !== null);

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full">
      <style>{KEYFRAMES}</style>

      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex items-center gap-1.5 text-orange-400">
          <Hammer className="w-5 h-5" />
          <span className="font-bold text-sm">
            {currentIndex + 1}/{words.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[var(--text-muted)]">
            Помилок: {mistakes}
          </span>
          <span className="text-2xl font-black text-[var(--text-main)]">
            {score}
          </span>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden mb-4">
        <div
          className="h-full bg-orange-400 transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <Card className="!p-5 mb-4 text-center">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] font-bold mb-2">
          Переклад
        </p>
        <p className="text-2xl font-black text-[var(--text-main)]">
          {currentWord.translation}
        </p>
      </Card>

      <Card className="!p-5 mb-4" style={{ animation: boardAnimation }}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {slots.map((tileIdx, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSlotClick(i)}
              disabled={tileIdx === null || !canInteract}
              className={`w-11 h-12 rounded-xl border-2 font-black text-xl flex items-center justify-center transition-all ${slotClass(
                i,
              )} ${
                tileIdx === null
                  ? "border-dashed opacity-60"
                  : "hover:brightness-110"
              }`}
            >
              {tileIdx === null ? "" : tiles[tileIdx].char}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 className="w-4 h-4 mr-1.5" />
            Скасувати
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!canClear}
          >
            <Eraser className="w-4 h-4 mr-1.5" />
            Очистити
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHint}
            disabled={!canHint}
            className={canHint ? "text-yellow-400" : undefined}
          >
            <Lightbulb className="w-4 h-4 mr-1.5" />
            Підказка ({hintsLeft})
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-auto">
        {tiles.map((tile, idx) => {
          const used = slots.includes(idx);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleLetterClick(idx)}
              disabled={used || !canInteract}
              className={`w-full aspect-square rounded-2xl border-2 font-black text-xl transition-all flex items-center justify-center ${
                used
                  ? "bg-transparent border-[var(--border-color)] text-transparent opacity-30"
                  : "bg-[var(--accent-cta)]/15 border-[var(--accent-cta)] text-[var(--text-main)] hover:bg-[var(--accent-cta)]/25 active:scale-95"
              }`}
            >
              {tile.char}
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
