import { useEffect, useState, type FC } from "react";
import type { GameProps, GameResult } from "../types";
import { getPracticeWordsApi, getWordsByLevel } from "../../entities/word/api";
import type { Word } from "../../entities/word/types";
import { useUserStore } from "../../store/userStore";
import { useLearningStore } from "../../store/learningStore";

// ---------------------------------------------------------------------------
// Константи гри
// ---------------------------------------------------------------------------

/** Верхня межа складності — комфортний максимум карток на мобільному екрані. */
const MAX_PAIRS = 6;
/** Нижня межа — менше вже не робить гру "пам'яттю", а не вгадайкою. */
const MIN_PAIRS = 3;
const MATCH_DELAY_MS = 350;
const MISMATCH_DELAY_MS = 700;

// ---------------------------------------------------------------------------
// Хелпери (раніше utils.ts) — інлайн, бо гра однофайлова
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

/** мс -> "m:ss", без агресивного зворотного відліку — просто секундомір. */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Типи колоди (раніше useWordMatchDeck.ts) — інлайн
// ---------------------------------------------------------------------------

type CardKind = "en" | "ua";

interface DeckCard {
  id: string;
  pairId: string;
  kind: CardKind;
  label: string;
}

interface CardState extends DeckCard {
  matched: boolean;
}

type DeckStatus = "loading" | "ready" | "error" | "insufficient";

interface DeckState {
  status: DeckStatus;
  cards: DeckCard[];
  words: Word[];
}

function buildCards(words: Word[]): DeckCard[] {
  const pairCards: DeckCard[] = words.flatMap((w) => [
    { id: `${w.id}-en`, pairId: w.id, kind: "en", label: w.text },
    { id: `${w.id}-ua`, pairId: w.id, kind: "ua", label: w.translation },
  ]);
  return shuffleArray(pairCards);
}

/**
 * Вантажить набір слів поточного рівня користувача (пріоритет — ті, що
 * вивчаються/повторюються через /progress/practice), і будує перемішану
 * колоду карток.
 *
 * Кількість пар АДАПТИВНА: від MIN_PAIRS до maxPairs — залежно від того,
 * скільки реально різних слів доступно користувачу на цьому рівні. Партія
 * можлива вже від MIN_PAIRS (3) унікальних слів; більше MIN_PAIRS, але
 * менше maxPairs — теж ок, просто менша дошка. "Замало слів" показуємо
 * лише коли доступно менше MIN_PAIRS.
 *
 * reload() тригерить новий запит + нове перемішування — тому кожна нова
 * партія містить інший набір слів у межах рівня користувача.
 */
function useWordMatchDeck(maxPairs: number = MAX_PAIRS) {
  const level = useUserStore((s) => s.level);
  const [state, setState] = useState<DeckState>({
    status: "loading",
    cards: [],
    words: [],
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading", cards: [], words: [] });

      if (!level) {
        if (!cancelled) setState({ status: "error", cards: [], words: [] });
        return;
      }

      try {
        // 1. Спершу — слова, що користувач вивчає/повторює (SM-2 practice queue)
        const practice = await getPracticeWordsApi();
        const dueIds = practice.dueWordIds || [];
        const seenIds = new Set<string>();
        const pool: Word[] = [];

        if (dueIds.length > 0) {
          let { categories, fetchCategories } = useLearningStore.getState();
          if (categories.length === 0) {
            await fetchCategories(level);
            categories = useLearningStore.getState().categories;
          }

          for (const cat of categories) {
            for (const unit of cat.units) {
              for (const step of unit.steps) {
                if (step.kind === "learn") {
                  for (const card of step.cards) {
                    if (dueIds.includes(card.id) && !seenIds.has(card.id)) {
                      pool.push({
                        id: card.id,
                        text: card.word,
                        translation: card.translation,
                        transcription: card.transcription,
                        exampleSentence: "",
                        exampleTranslation: "",
                        level: level,
                        topic: cat.title,
                      });
                      seenIds.add(card.id);
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Якщо їх замало на комфортну дошку — добираємо рештою слів цього рівня
        if (pool.length < maxPairs) {
          const levelWords = await getWordsByLevel(level);
          for (const w of levelWords) {
            if (!seenIds.has(w.id)) {
              pool.push(w);
              seenIds.add(w.id);
            }
          }
        }

        if (cancelled) return;

        // "Замало слів" — тільки якщо реально менше мінімально грайбельного
        // порогу (3 пари). У всіх інших випадках граємо стільки пар, скільки
        // є унікальних слів, аж до maxPairs.
        if (pool.length < MIN_PAIRS) {
          setState({ status: "insufficient", cards: [], words: [] });
          return;
        }

        const pairsToUse = Math.min(maxPairs, pool.length);
        const chosenWords = shuffleArray(pool).slice(0, pairsToUse);
        const cards = buildCards(chosenWords);

        setState({ status: "ready", cards, words: chosenWords });
      } catch (error) {
        console.error("word-match: не вдалося завантажити слова", error);
        if (!cancelled) setState({ status: "error", cards: [], words: [] });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [level, maxPairs, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  return { ...state, reload };
}

// ---------------------------------------------------------------------------
// Презентаційна картка (раніше Card.tsx) — інлайн
// ---------------------------------------------------------------------------

interface WordMatchCardProps {
  card: DeckCard;
  isFlipped: boolean;
  isMatched: boolean;
  isWrong: boolean;
  disabled: boolean;
  onTap: () => void;
}

const WordMatchCard: FC<WordMatchCardProps> = ({
  card,
  isFlipped,
  isMatched,
  isWrong,
  disabled,
  onTap,
}) => {
  const showFace = isFlipped || isMatched;

  const faceClasses = isMatched
    ? "bg-[var(--accent-success)] border-[var(--accent-success)] text-[var(--text-accent)]"
    : isWrong
      ? "bg-[var(--bg-card-hover)] border-[var(--accent-error)] text-[var(--text-main)]"
      : "bg-[var(--bg-card-hover)] border-[var(--accent-cta)] text-[var(--text-main)]";

  const backClasses =
    "bg-[var(--bg-card-elevated)] border-[var(--border-color)] text-[var(--text-muted)]";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled || isMatched}
      aria-label={showFace ? card.label : "Закрита картка"}
      className={`aspect-square w-full rounded-2xl border-2 flex items-center justify-center
        px-1 text-center text-xs sm:text-sm leading-tight font-semibold break-words
        transition-colors duration-150 active:scale-95 touch-manipulation
        ${showFace ? faceClasses : backClasses}
        ${isMatched ? "opacity-90" : ""}`}
    >
      {showFace ? card.label : "🍪"}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Головний компонент гри
// ---------------------------------------------------------------------------

interface ResultSummary {
  score: number;
  moves: number;
  timeMs: number;
  accuracy: number;
  pairs: number;
}

export const WordMatchGame: FC<GameProps> = ({ onFinish }) => {
  const deck = useWordMatchDeck(MAX_PAIRS);

  const [cards, setCards] = useState<CardState[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<ResultSummary | null>(null);

  // Стартуємо нову партію щоразу, коли колода готова (перший раз і після "Ще раз")
  useEffect(() => {
    if (deck.status !== "ready") return;
    setCards(deck.cards.map((c) => ({ ...c, matched: false })));
    setFlippedIds([]);
    setWrongIds([]);
    setMoves(0);
    setMatchedCount(0);
    setIsLocked(false);
    setResult(null);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setIsPlaying(true);
  }, [deck.status, deck.cards]);

  // Секундомір для власного рекорду гравця — без агресивного зворотного відліку
  useEffect(() => {
    if (!isPlaying || startedAt === null) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [isPlaying, startedAt]);

  const handleTap = (card: CardState) => {
    if (!isPlaying || isLocked || card.matched || flippedIds.includes(card.id))
      return;

    const nextFlipped = [...flippedIds, card.id];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) return;

    setIsLocked(true);
    const newMoves = moves + 1;
    setMoves(newMoves);

    const [firstId, secondId] = nextFlipped;
    const first = cards.find((c) => c.id === firstId);
    const second = cards.find((c) => c.id === secondId);
    const isMatch = !!first && !!second && first.pairId === second.pairId;

    if (isMatch) {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === firstId || c.id === secondId ? { ...c, matched: true } : c,
          ),
        );
        setFlippedIds([]);
        setIsLocked(false);
        setMatchedCount((count) => {
          const nextCount = count + 1;
          if (nextCount === cards.length / 2) {
            finishGame(newMoves, nextCount);
          }
          return nextCount;
        });
      }, MATCH_DELAY_MS);
    } else {
      setWrongIds([firstId, secondId]);
      setTimeout(() => {
        setFlippedIds([]);
        setWrongIds([]);
        setIsLocked(false);
      }, MISMATCH_DELAY_MS);
    }
  };

  const finishGame = (finalMoves: number, pairs: number) => {
    const timeMs = startedAt ? Date.now() - startedAt : 0;
    const extraMoves = Math.max(0, finalMoves - pairs);
    const score = Math.max(20, pairs * 100 - extraMoves * 10);
    const accuracy = Math.round((pairs / finalMoves) * 100);

    setIsPlaying(false);
    setResult({ score, moves: finalMoves, timeMs, accuracy, pairs });
  };

  const handleFinishClick = () => {
    if (!result) return;
    const gameResult: GameResult = {
      score: result.score,
      wordsLearned: deck.words.map((w) => w.text),
      moves: result.moves,
      timeMs: result.timeMs,
      accuracy: result.accuracy,
    };
    onFinish(gameResult);
  };

  if (deck.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
        <p className="text-[var(--text-muted)]">Готуємо картки...</p>
      </div>
    );
  }

  if (deck.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
        <p className="text-[var(--text-main)] font-semibold">
          Не вдалося завантажити слова
        </p>
        <p className="text-[var(--text-muted)] text-sm">
          Перевір з'єднання і спробуй ще раз.
        </p>
        <button
          onClick={() => deck.reload()}
          className="mt-2 px-5 py-2 rounded-xl bg-[var(--accent-cta)] text-[var(--text-accent)] font-semibold active:bg-[var(--accent-cta-active)]"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  if (deck.status === "insufficient") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center h-full">
        <p className="text-[var(--text-main)] font-semibold">
          Замало слів для гри
        </p>
        <p className="text-[var(--text-muted)] text-sm">
          Вивчи ще трохи слів на своєму рівні — і повертайся сюди!
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center h-full">
        <p className="text-3xl">🍪</p>
        <h2 className="text-xl font-bold text-[var(--text-main)]">Готово!</h2>
        <div className="w-full max-w-[280px] bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Очки</span>
            <span className="text-[var(--text-main)] font-semibold">
              {result.score}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Ходів</span>
            <span className="text-[var(--text-main)] font-semibold">
              {result.moves}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Час</span>
            <span className="text-[var(--text-main)] font-semibold">
              {formatTime(result.timeMs)}
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
            onClick={() => deck.reload()}
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--text-muted)]">
        <span>
          Пари:{" "}
          <span className="text-[var(--text-main)] font-semibold">
            {matchedCount}/{cards.length / 2}
          </span>
        </span>
        <span>
          Ходи:{" "}
          <span className="text-[var(--text-main)] font-semibold">{moves}</span>
        </span>
        <span>
          Час:{" "}
          <span className="text-[var(--text-main)] font-semibold">
            {formatTime(elapsedMs)}
          </span>
        </span>
      </div>

      <div className="flex-1 px-4 pb-4">
        <div
          className={`grid gap-2 max-w-[380px] mx-auto ${
            cards.length <= 6 ? "grid-cols-3" : "grid-cols-4"
          }`}
        >
          {cards.map((card) => (
            <WordMatchCard
              key={card.id}
              card={card}
              isFlipped={flippedIds.includes(card.id)}
              isMatched={card.matched}
              isWrong={wrongIds.includes(card.id)}
              disabled={isLocked}
              onTap={() => handleTap(card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
