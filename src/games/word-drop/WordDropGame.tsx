import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Heart,
  Lightbulb,
  Play,
  Snowflake,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { shuffle, useShuffledOptions } from "../../shared/lib/shuffle";
import type { GameProps } from "../types";
import {
  WORDS_BY_LEVEL,
  WORD_LEVELS,
  pickRandomWords,
  type WordEntry,
  type WordLevel,
} from "../words";

type GameStatus = "setup" | "playing" | "gameover";
type Difficulty = "chill" | "normal" | "hardcore";
type MeteorKind = "normal" | "swift";

interface DifficultyConfig {
  label: string;
  emoji: string;
  speed: number;
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  chill: { label: "Chill", emoji: "🌿", speed: 0.008 },
  normal: { label: "Normal", emoji: "⚡", speed: 0.013 },
  hardcore: { label: "Hardcore", emoji: "💀", speed: 0.02 },
};

const LIVES_TOTAL = 3;
const COUNT_OPTIONS = [5, 10, 15, 20] as const;
const METEOR_START_PERCENT = 8;
const FEVER_STREAK = 5;
const HINT_FREEZE_MS = 2500;
const SWIFT_CHANCE = 0.25;
const SWIFT_SPEED_MULT = 1.5;

const KEYFRAMES = `
@keyframes wd-burst {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2); opacity: 0; }
}
@keyframes wd-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-10px); }
  30% { transform: translateX(9px); }
  45% { transform: translateX(-7px); }
  60% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
}
@keyframes wd-fever {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.7; }
}
`;

const computeScoreGain = (
  streak: number,
  kind: MeteorKind,
  fever: boolean,
): number => {
  const combo = Math.min(1 + Math.floor(streak / 3), 4);
  const kindBonus = kind === "swift" ? 2 : 1;
  const feverMult = fever ? 2 : 1;
  return combo * kindBonus * feverMult;
};

interface OptionsBlockProps {
  options: string[];
  correct: string;
  itemId: string;
  onAnswer: (opt: string) => void;
}

const OptionsBlock = ({
  options,
  correct,
  itemId,
  onAnswer,
}: OptionsBlockProps) => {
  const shuffled = useShuffledOptions(options, correct, itemId);
  return (
    <div className="grid grid-cols-1 gap-3 shrink-0 pb-4">
      {shuffled.map((opt, idx) => (
        <Button
          key={`${itemId}-${idx}`}
          variant="secondary"
          onClick={() => onAnswer(opt)}
          className="py-5 text-lg font-bold border-2"
        >
          {opt}
        </Button>
      ))}
    </div>
  );
};

const BurstLayer = ({ y }: { y: number }) => (
  <div className="absolute inset-0 pointer-events-none z-30">
    {Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 60 + Math.random() * 50;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const style = {
        left: "50%",
        top: `${y}%`,
        "--dx": `${dx}px`,
        "--dy": `${dy}px`,
        animation: "wd-burst 700ms ease-out forwards",
      } as React.CSSProperties;
      return (
        <span
          key={i}
          className="absolute w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)]"
          style={style}
        />
      );
    })}
  </div>
);

export const WordDropGame = ({ onFinish }: GameProps) => {
  const [status, setStatus] = useState<GameStatus>("setup");
  const [level, setLevel] = useState<WordLevel>("A1");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [count, setCount] = useState<number>(10);

  const [words, setWords] = useState<WordEntry[]>([]);
  const [pool, setPool] = useState<WordEntry[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(LIVES_TOTAL);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wordsLearned, setWordsLearned] = useState<string[]>([]);
  const [meteorY, setMeteorY] = useState(METEOR_START_PERCENT);
  const [meteorKind, setMeteorKind] = useState<MeteorKind>("normal");

  const [isShaking, setIsShaking] = useState(false);
  const [burst, setBurst] = useState<{ id: number; y: number } | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [best, setBest] = useState(0);
  const [isRecord, setIsRecord] = useState(false);

  const bestKey = `word-drop-best:${level}:${difficulty}`;

  const yRef = useRef(METEOR_START_PERCENT);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const resolvedRef = useRef(false);
  const kindRef = useRef<MeteorKind>("normal");
  const frozenUntilRef = useRef(0);
  const hintUsedRef = useRef(false);

  const stateRef = useRef({ words, currentIndex, status });
  useEffect(() => {
    stateRef.current = { words, currentIndex, status };
  }, [words, currentIndex, status]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    const stored = localStorage.getItem(bestKey);
    setBest(stored ? parseInt(stored, 10) || 0 : 0);
  }, [bestKey]);

  const currentWord = words[currentIndex];
  const fever = streak >= FEVER_STREAK;
  const baseSpeed = DIFFICULTIES[difficulty].speed;

  useEffect(() => {
    if (status !== "playing") return;
    yRef.current = METEOR_START_PERCENT;
    setMeteorY(METEOR_START_PERCENT);
    lastTimeRef.current = undefined;
    resolvedRef.current = false;
    setIsFrozen(false);

    const kind: MeteorKind = Math.random() < SWIFT_CHANCE ? "swift" : "normal";
    kindRef.current = kind;
    setMeteorKind(kind);
  }, [currentIndex, status]);

  useEffect(() => {
    if (status !== "playing") return;
    if (lives > 0 && currentIndex < words.length) return;

    setFinishedAt(Date.now());
    setStatus("gameover");

    const prevBest = parseInt(localStorage.getItem(bestKey) || "0", 10);
    if (score > prevBest) {
      localStorage.setItem(bestKey, String(score));
      setBest(score);
      setIsRecord(true);
    } else {
      setIsRecord(false);
    }
  }, [lives, currentIndex, words.length, status, score, bestKey]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    window.setTimeout(() => setIsShaking(false), 400);
  }, []);

  const handleResult = useCallback(
    (correct: boolean) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;

      const s = stateRef.current;
      const word = s.words[s.currentIndex];
      if (!word) return;

      if (correct) {
        const nextStreak = streakRef.current + 1;
        const feverNow = nextStreak - 1 >= FEVER_STREAK;
        const gain = computeScoreGain(
          streakRef.current,
          kindRef.current,
          feverNow,
        );
        setScore((v) => v + gain);
        setStreak(nextStreak);
        setMaxStreak((v) => Math.max(v, nextStreak));
        setHits((v) => v + 1);
        setWordsLearned((prev) =>
          prev.includes(word.word) ? prev : [...prev, word.word],
        );
        setBurst({ id: Date.now(), y: yRef.current });
        window.setTimeout(() => setBurst(null), 700);
      } else {
        setStreak(0);
        setLives((v) => v - 1);
        setMisses((v) => v + 1);
        triggerShake();
      }

      setCurrentIndex(s.currentIndex + 1);
    },
    [triggerShake],
  );

  const handleResultRef = useRef(handleResult);
  useEffect(() => {
    handleResultRef.current = handleResult;
  }, [handleResult]);

  const baseSpeedRef = useRef(baseSpeed);
  useEffect(() => {
    baseSpeedRef.current = baseSpeed;
  }, [baseSpeed]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current != null && !resolvedRef.current) {
      const delta = time - lastTimeRef.current;
      if (time >= frozenUntilRef.current) {
        const kindMult = kindRef.current === "swift" ? SWIFT_SPEED_MULT : 1;
        const speed = baseSpeedRef.current + scoreRef.current * 0.0004;
        yRef.current += delta * speed * kindMult;
        if (yRef.current >= 100) {
          handleResultRef.current(false);
        } else {
          setMeteorY(yRef.current);
        }
      }
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, animate]);

  const handleHint = useCallback(() => {
    if (hintUsedRef.current) return;
    hintUsedRef.current = true;
    setHintUsed(true);
    frozenUntilRef.current = performance.now() + HINT_FREEZE_MS;
    setIsFrozen(true);
    window.setTimeout(() => setIsFrozen(false), HINT_FREEZE_MS);
  }, []);

  const startGame = useCallback(() => {
    const levelPool = WORDS_BY_LEVEL[level];
    const picked = pickRandomWords(level, count);

    setPool(levelPool);
    setWords(picked);
    setCurrentIndex(0);
    setLives(LIVES_TOTAL);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setHits(0);
    setMisses(0);
    setWordsLearned([]);
    setMeteorY(METEOR_START_PERCENT);
    yRef.current = METEOR_START_PERCENT;
    lastTimeRef.current = undefined;
    resolvedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    frozenUntilRef.current = 0;
    hintUsedRef.current = false;
    setHintUsed(false);
    setIsFrozen(false);
    setIsRecord(false);
    setStartedAt(Date.now());
    setFinishedAt(0);
    setStatus("playing");
  }, [level, count]);

  const options = useMemo(() => {
    if (!currentWord || pool.length < 3) return [];
    const others = pool.filter(
      (w) => w.translation !== currentWord.translation,
    );
    const distractors = shuffle(others)
      .slice(0, 2)
      .map((w) => w.translation);
    return [currentWord.translation, ...distractors];
  }, [currentWord, pool]);

  /* ------------------------------- Setup ------------------------------- */
  if (status === "setup") {
    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <style>{KEYFRAMES}</style>

        <Card className="!p-6 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-8 h-8 text-orange-500" />
            <h1 className="text-2xl font-black text-[var(--text-main)]">
              Метеоритний Дощ
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Слова падають згори — встигни обрати переклад до удару. Швидкі
            метеорити (⚡) дають ×2, а комбо і Fever множать рахунок.
          </p>
        </Card>

        <Card className="!p-5 mb-4">
          <p className="font-bold mb-3 text-[var(--text-main)]">
            Рівень складності слів
          </p>
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
        </Card>

        <Card className="!p-5 mb-4">
          <p className="font-bold mb-3 text-[var(--text-main)]">
            Швидкість падіння
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? "primary" : "secondary"}
                size="sm"
                onClick={() => setDifficulty(d)}
              >
                {DIFFICULTIES[d].emoji} {DIFFICULTIES[d].label}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="!p-5 mb-4">
          <p className="font-bold mb-3 text-[var(--text-main)]">
            Кількість слів
          </p>
          <div className="grid grid-cols-4 gap-2">
            {COUNT_OPTIONS.map((c) => (
              <Button
                key={c}
                variant={count === c ? "primary" : "secondary"}
                size="sm"
                onClick={() => setCount(c)}
              >
                {c}
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
    const totalAnswers = hits + misses;
    const accuracy =
      totalAnswers === 0 ? 0 : Math.round((hits / totalAnswers) * 100);

    return (
      <div className="flex flex-col h-full p-4 max-w-md mx-auto w-full overflow-y-auto">
        <style>{KEYFRAMES}</style>

        <div className="flex flex-col items-center justify-center pt-6 pb-4 space-y-4">
          <Flame className="w-16 h-16 text-orange-500" />
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
            <Stat label="Точність" value={`${accuracy}%`} />
            <Stat label="Макс. стрик" value={maxStreak} />
            <Stat label="Час" value={`${durationSec} с`} />
          </div>
        </Card>

        {wordsLearned.length > 0 && (
          <Card className="!p-5 mb-4">
            <p className="font-bold mb-3 text-[var(--text-main)]">
              Вивчені слова ({wordsLearned.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {wordsLearned.map((w) => (
                <span
                  key={w}
                  className="px-3 py-1 rounded-full bg-[var(--bg-card-elevated)] text-sm font-bold text-[var(--text-main)] border border-[var(--border-color)]"
                >
                  {w}
                </span>
              ))}
            </div>
          </Card>
        )}

        <div className="mt-auto w-full space-y-3 pt-2">
          <Button onClick={startGame} className="w-full py-4 text-lg">
            <Sparkles className="w-5 h-5 mr-2" />
            Грати ще
          </Button>
          <Button
            variant="secondary"
            onClick={() => setStatus("setup")}
            className="w-full py-4 text-lg"
          >
            Змінити налаштування
          </Button>
          <Button
            variant="ghost"
            onClick={() => onFinish({ score, wordsLearned })}
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

  const itemId = `${currentIndex}:${currentWord.word}`;
  const isSwift = meteorKind === "swift";

  return (
    <div
      className="flex flex-col h-full p-4 max-w-md mx-auto w-full"
      style={{
        animation: isShaking ? "wd-shake 400ms ease-in-out" : undefined,
      }}
    >
      <style>{KEYFRAMES}</style>

      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex gap-1 text-red-500">
          {Array.from({ length: LIVES_TOTAL }).map((_, i) => (
            <Heart
              key={i}
              className={`w-6 h-6 transition-all ${
                i < lives ? "fill-current scale-100" : "opacity-20 scale-90"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {fever && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/25 text-orange-400 text-xs font-black">
              <Flame className="w-3 h-3" /> FEVER ×2
            </span>
          )}
          {!fever && streak >= 2 && (
            <span className="text-orange-400 font-bold text-sm">
              🔥 x{streak}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)] font-bold">
            {currentIndex + 1}/{words.length}
          </span>
          <span className="text-2xl font-black text-[var(--text-main)] drop-shadow-sm">
            {score}
          </span>
        </div>
      </div>

      <Card className="flex-1 min-h-[320px] relative overflow-hidden mb-4 !p-0 !bg-slate-900 !border-slate-700">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.25),transparent_60%)]" />

        {fever && (
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.55),transparent_65%)]"
            style={{ animation: "wd-fever 1.2s ease-in-out infinite" }}
          />
        )}

        {isFrozen && (
          <div className="absolute inset-0 z-20 bg-blue-400/10 flex items-center justify-center">
            <Snowflake className="w-12 h-12 text-blue-300 animate-pulse" />
          </div>
        )}

        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none z-10 px-6"
          style={{ top: `${meteorY}%` }}
        >
          <div
            className={`text-white font-black text-2xl px-7 py-4 rounded-full flex items-center gap-2 border-2 whitespace-nowrap ${
              isSwift
                ? "bg-gradient-to-b from-yellow-300 via-orange-500 to-red-700 border-yellow-200 shadow-[0_0_40px_rgba(250,204,21,0.95)]"
                : "bg-gradient-to-b from-orange-400 to-red-600 border-orange-200 shadow-[0_0_30px_rgba(249,115,22,0.9)]"
            }`}
          >
            {isSwift ? (
              <Zap className="w-6 h-6 animate-pulse" />
            ) : (
              <Flame className="w-6 h-6 animate-pulse" />
            )}
            {currentWord.word}
            {isSwift && (
              <span className="ml-1 text-xs bg-white/25 px-2 py-0.5 rounded-full">
                ×2
              </span>
            )}
          </div>
        </div>

        {burst && <BurstLayer key={burst.id} y={burst.y} />}

        <button
          type="button"
          onClick={handleHint}
          disabled={hintUsed}
          className={`absolute top-3 right-3 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            hintUsed
              ? "bg-slate-800/60 text-slate-600"
              : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 active:scale-95"
          }`}
          aria-label="Підказка"
        >
          <Lightbulb className="w-5 h-5" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400/60" />
      </Card>

      <OptionsBlock
        key={itemId}
        options={options}
        correct={currentWord.translation}
        itemId={itemId}
        onAnswer={(opt) => handleResult(opt === currentWord.translation)}
      />
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
