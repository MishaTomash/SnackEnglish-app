import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  X,
  Volume2,
  Check,
  XCircle,
  Mic,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Turtle,
} from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { ProgressBar } from "../../shared/ui/ProgressBar";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import { useLearningStore } from "../../store/learningStore";
import {
  speak,
  speakSlow,
  stopSpeech,
  similarity,
  isSpeechRecognitionAvailable,
} from "../../shared/lib/speech";
import { useShuffledOptions } from "../../shared/lib/shuffle";
import { hapticSelectNode } from "../../shared/lib/telegramHaptics";
import type {
  ListeningData,
  QuizData,
  SentenceBuildData,
  SpeakData,
  WordCardData,
} from "../../entities/learning/types";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((e: { results: Array<Array<{ transcript: string }>> }) => void)
    | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

const SIMILARITY_PASS_THRESHOLD = 0.7;

const AnswerOptions = <T extends string>({
  options,
  correctAnswer,
  picked,
  onPick,
}: {
  options: readonly T[];
  correctAnswer: T;
  picked: T | null;
  onPick: (opt: T) => void;
}) => (
  <div className="space-y-2.5">
    {options.map((opt) => {
      const isThis = picked === opt;
      const showCorrect = picked && opt === correctAnswer;
      const showWrong = picked && isThis && opt !== correctAnswer;
      return (
        <button
          key={opt}
          onClick={() => {
            hapticSelectNode();
            onPick(opt);
          }}
          disabled={!!picked}
          className={`w-full p-4 rounded-2xl font-bold text-left border-2 flex justify-between items-center transition-all ${
            showCorrect
              ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
              : showWrong
                ? "bg-rose-500/10 border-rose-500 text-rose-400"
                : picked
                  ? "bg-[var(--bg-card)] border-[var(--border-color)] opacity-50"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] active:scale-[0.99]"
          }`}
        >
          <span>{opt}</span>
          {showCorrect && <Check className="w-5 h-5" />}
          {showWrong && <XCircle className="w-5 h-5" />}
        </button>
      );
    })}
  </div>
);

const LearnView = ({
  cards,
  index,
  onNext,
}: {
  cards: WordCardData[];
  index: number;
  onNext: () => void;
}) => {
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  useEffect(() => {
    setFlipped(false);
    return () => stopSpeech();
  }, [card.word]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card
        interactive
        onClick={() => {
          hapticSelectNode();
          setFlipped((f) => !f);
        }}
        className="relative min-h-[320px] flex flex-col items-center justify-center text-center !p-8 cursor-pointer select-none"
      >
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-4">
          {index + 1} з {cards.length} ·{" "}
          {flipped ? "Переклад" : "Торкнись, щоб побачити переклад"}
        </span>

        {!flipped ? (
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-[var(--text-main)]">
              {card.word}
            </h2>
            <p className="text-sm text-[var(--text-muted)] font-mono">
              {card.transcription}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(card.word, { force: true });
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] font-bold text-sm active:scale-95"
            >
              <Volume2 className="w-4 h-4" /> Прослухати
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-[var(--accent-cta)]">
              {card.translation}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">{card.word}</p>
          </div>
        )}
      </Card>

      <Button variant="primary" className="w-full" onClick={onNext}>
        {index < cards.length - 1 ? "Наступне слово" : "Продовжити"}
      </Button>
    </div>
  );
};

const QuizView = ({
  item,
  index,
  total,
  onAnswer,
}: {
  item: QuizData;
  index: number;
  total: number;
  onAnswer: (correct: boolean) => void;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useShuffledOptions(item.options, item.correctAnswer, item.id);
  const isCorrect = picked === item.correctAnswer;

  useEffect(() => setPicked(null), [item.id]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card className="text-center !p-6 space-y-3">
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
          Запитання {index + 1} з {total}
        </span>
        <h2 className="text-lg font-black text-[var(--text-main)] leading-snug">
          {item.question}
        </h2>
      </Card>

      <AnswerOptions
        options={options}
        correctAnswer={item.correctAnswer}
        picked={picked}
        onPick={setPicked}
      />

      {picked && (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onAnswer(isCorrect)}
        >
          {index < total - 1 ? "Далі" : "Продовжити"}
        </Button>
      )}
    </div>
  );
};

const ListeningView = ({
  item,
  index,
  total,
  onAnswer,
}: {
  item: ListeningData;
  index: number;
  total: number;
  onAnswer: (correct: boolean) => void;
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  const options = useShuffledOptions(item.options, item.correctAnswer, item.id);
  const isCorrect = picked === item.correctAnswer;

  useEffect(() => {
    setPicked(null);
    const t = setTimeout(() => speakSlow(item.phrase), 400);
    return () => {
      clearTimeout(t);
      stopSpeech();
    };
  }, [item.id, item.phrase]);

  const replaySlow = () => {
    stopSpeech();
    speakSlow(item.phrase);
  };

  const replayNormal = () => {
    stopSpeech();
    speak(item.phrase, { rate: 1.0, force: true });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card className="text-center !p-6 space-y-4">
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
          Аудіо {index + 1} з {total}
        </span>
        <div className="flex justify-center gap-3">
          <button
            onClick={replaySlow}
            className="w-16 h-16 rounded-full bg-[var(--accent-cta)]/15 text-[var(--accent-cta)] flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Повільно"
          >
            <Turtle className="w-7 h-7" />
          </button>
          <button
            onClick={replayNormal}
            className="w-16 h-16 rounded-full bg-[var(--accent-cta)] text-[var(--text-accent)] flex items-center justify-center active:scale-95 transition-transform shadow-lg"
            aria-label="Нормальна швидкість"
          >
            <Volume2 className="w-7 h-7" />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          🐢 — повільно · 🔊 — нормально
        </p>
        <p className="text-sm font-bold text-[var(--text-main)]">
          Що ти почув?
        </p>
      </Card>

      <AnswerOptions
        options={options}
        correctAnswer={item.correctAnswer}
        picked={picked}
        onPick={setPicked}
      />

      {picked && (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onAnswer(isCorrect)}
        >
          {index < total - 1 ? "Далі" : "Продовжити"}
        </Button>
      )}
    </div>
  );
};

const SpeakView = ({
  item,
  index,
  total,
  onAnswer,
}: {
  item: SpeakData;
  index: number;
  total: number;
  onAnswer: (correct: boolean) => void;
}) => {
  const [phase, setPhase] = useState<"idle" | "listening" | "result">("idle");
  const [transcript, setTranscript] = useState("");
  const [matched, setMatched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = isSpeechRecognitionAvailable();

  useEffect(() => {
    setPhase("idle");
    setTranscript("");
    setMatched(false);
    setErrorMsg(null);
    return () => {
      stopSpeech();
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // ignore
      }
    };
  }, [item.id]);

  const playPhrase = () => {
    stopSpeech();
    speak(item.phrase, { rate: 1.0, force: true });
  };

  const playSlow = () => {
    stopSpeech();
    speakSlow(item.phrase);
  };

  const startRecognition = () => {
    if (!supported) return;
    stopSpeech();
    setTranscript("");
    setMatched(false);
    setErrorMsg(null);

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setErrorMsg("Розпізнавання мовлення недоступне");
      setPhase("result");
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let gotResult = false;

    rec.onresult = (e) => {
      gotResult = true;
      const text = String(e.results?.[0]?.[0]?.transcript ?? "");
      setTranscript(text);
      const score = similarity(text, item.phrase);
      setMatched(score >= SIMILARITY_PASS_THRESHOLD);
      setPhase("result");
    };

    rec.onerror = (e) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setErrorMsg("Немає дозволу на мікрофон");
      } else if (code === "no-speech") {
        setErrorMsg("Нічого не почуто — спробуй ще раз");
      } else if (code === "audio-capture") {
        setErrorMsg("Мікрофон недоступний");
      } else if (code !== "aborted") {
        setErrorMsg("Не вдалося розпізнати. Спробуй ще раз");
      }
    };

    rec.onend = () => {
      if (!gotResult) {
        setMatched(false);
        setPhase((p) => (p === "listening" ? "result" : p));
      }
    };

    recognitionRef.current = rec;
    setPhase("listening");
    try {
      rec.start();
    } catch {
      setErrorMsg("Не вдалося запустити мікрофон");
      setPhase("result");
    }
  };

  const stopRecognition = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card className="text-center !p-6 space-y-4">
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
          Фраза {index + 1} з {total}
        </span>
        <h2 className="text-xl font-black text-[var(--text-main)] leading-snug">
          {item.phrase}
        </h2>
        <p className="text-xs text-[var(--text-muted)] italic">
          {item.translation}
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={playPhrase}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] font-bold text-sm active:scale-95"
          >
            <Volume2 className="w-4 h-4" /> Послухати
          </button>
          <button
            onClick={playSlow}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] font-bold text-sm active:scale-95"
          >
            <Turtle className="w-4 h-4" /> Повільно
          </button>
        </div>
      </Card>

      {supported ? (
        <Card className="text-center !p-6 space-y-4">
          {phase === "idle" && (
            <>
              <button
                onClick={startRecognition}
                className="mx-auto w-24 h-24 rounded-full bg-[var(--accent-cta)] text-[var(--text-accent)] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Mic className="w-10 h-10" />
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                Торкнись і повтори фразу вголос
              </p>
            </>
          )}

          {phase === "listening" && (
            <>
              <div className="mx-auto w-24 h-24 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center animate-pulse">
                <Mic className="w-10 h-10" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">
                Слухаю… говори чітко
              </p>
              <Button variant="secondary" size="sm" onClick={stopRecognition}>
                Стоп
              </Button>
            </>
          )}

          {phase === "result" && (
            <div className="space-y-3">
              <div
                className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                  matched
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {matched ? (
                  <Check className="w-8 h-8" />
                ) : (
                  <Sparkles className="w-8 h-8" />
                )}
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">
                {matched
                  ? "Супер вимова!"
                  : (errorMsg ?? "Майже! Спробуй ще раз")}
              </p>
              {transcript && (
                <p className="text-xs text-[var(--text-muted)] italic">
                  Я почув: «{transcript}»
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={startRecognition}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> Ще раз
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => onAnswer(matched)}
                >
                  {index < total - 1 ? "Далі" : "Завершити"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center !p-6 space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Розпізнавання мовлення недоступне в цьому браузері.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Просто повтори фразу вголос і продовж 🎤
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => onAnswer(true)}
          >
            Я повторив(ла)
          </Button>
        </Card>
      )}
    </div>
  );
};

const normalizeSentence = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");

const shuffleWords = (words: string[]): string[] => {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const SentenceBuildView = ({
  item,
  index,
  total,
  onAnswer,
}: {
  item: SentenceBuildData;
  index: number;
  total: number;
  onAnswer: (correct: boolean) => void;
}) => {
  const shuffledBank = useMemo(
    () => shuffleWords(item.wordBank),
    [item.id, item.wordBank],
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    setSelected([]);
    setChecked(false);
    setIsCorrect(false);
  }, [item.id]);

  const availableIndices = shuffledBank
    .map((_, i) => i)
    .filter((i) => !selected.includes(i));

  const builtSentence = selected.map((i) => shuffledBank[i]).join(" ");

  const handleCheck = () => {
    hapticSelectNode();
    const correct =
      normalizeSentence(builtSentence) ===
      normalizeSentence(item.correctSentence);
    setIsCorrect(correct);
    setChecked(true);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Card className="text-center !p-6 space-y-3">
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
          Речення {index + 1} з {total}
        </span>
        <h2 className="text-lg font-black text-[var(--text-main)] leading-snug">
          {item.translation}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Склади речення зі слів нижче
        </p>
      </Card>

      <Card className="!p-4 min-h-[64px] flex flex-wrap gap-2 items-center">
        {selected.length === 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            Тапни слова знизу, щоб скласти речення
          </span>
        )}
        {selected.map((wordIdx, pos) => (
          <button
            key={pos}
            onClick={() => {
              if (checked) return;
              hapticSelectNode();
              setSelected((s) => s.filter((_, i) => i !== pos));
            }}
            disabled={checked}
            className="px-3 py-2 rounded-xl bg-[var(--accent-cta)] text-[var(--text-accent)] font-bold text-sm active:scale-95 disabled:opacity-70"
          >
            {shuffledBank[wordIdx]}
          </button>
        ))}
      </Card>

      <div className="flex flex-wrap gap-2">
        {availableIndices.map((wordIdx) => (
          <button
            key={wordIdx}
            onClick={() => {
              hapticSelectNode();
              setSelected((s) => [...s, wordIdx]);
            }}
            disabled={checked}
            className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] font-bold text-sm active:scale-95 disabled:opacity-50"
          >
            {shuffledBank[wordIdx]}
          </button>
        ))}
      </div>

      {checked && (
        <Card
          className={`!p-4 text-center text-sm font-bold flex items-center justify-center gap-2 ${
            isCorrect ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isCorrect ? (
            <>
              <Check className="w-4 h-4" /> Правильно!
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 shrink-0" />
              Правильно: «{item.correctSentence}»
            </>
          )}
        </Card>
      )}

      {!checked ? (
        <Button
          variant="primary"
          className="w-full"
          onClick={handleCheck}
          disabled={selected.length === 0}
        >
          Перевірити
        </Button>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onAnswer(isCorrect)}
        >
          {index < total - 1 ? "Далі" : "Продовжити"}
        </Button>
      )}
    </div>
  );
};

const CompletionScreen = ({
  accuracy,
  correct,
  total,
  xp,
  onContinue,
}: {
  accuracy: number;
  correct: number;
  total: number;
  xp: number;
  onContinue: () => void;
}) => (
  <Screen className="justify-center items-center p-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-bounce opacity-60"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 61) % 80}%`,
            animationDelay: `${i * 0.12}s`,
          }}
        >
          {["✨", "🎉", "🍪", "⭐"][i % 4]}
        </span>
      ))}
    </div>

    <div className="relative z-10 space-y-6 max-w-sm w-full">
      <CookieMascot state="celebrating" size={110} />
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-[var(--text-main)]">
          Чудово! 🎉
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Ти щойно опанував(ла) нову тему
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center">
          <div className="text-2xl font-black text-[var(--accent-cta)]">
            +{xp}
          </div>
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mt-1">
            XP
          </div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-black text-emerald-400">
            {accuracy}%
          </div>
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mt-1">
            Точність
          </div>
        </Card>
        <Card className="!p-3 text-center">
          <div className="text-2xl font-black text-[var(--text-main)]">
            {correct}/{total}
          </div>
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mt-1">
            Правильно
          </div>
        </Card>
      </div>

      <Button variant="primary" className="w-full" onClick={onContinue}>
        Продовжити <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  </Screen>
);

export const LessonRunner = () => {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { markUnitCompleted, categories } = useLearningStore();

  const found = useMemo(() => {
    for (const category of categories) {
      const unit = category.units.find((u) => u.id === unitId);
      if (unit) return { category, unit };
    }
    return null;
  }, [unitId, categories]);

  const [stepIdx, setStepIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<"run" | "done">("run");

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  if (!found || found.unit.steps.length === 0) {
    return (
      <Screen className="justify-center items-center gap-4 p-6 text-center">
        <p className="text-[var(--text-muted)]">Урок не знайдено</p>
        <Button variant="secondary" onClick={() => navigate("/learning")}>
          До навчання
        </Button>
      </Screen>
    );
  }

  const { unit, category } = found;
  const step = unit.steps[stepIdx];

  const totalQuestions = unit.steps.reduce(
    (acc, s) => acc + (s.kind === "learn" ? 0 : s.items.length),
    0,
  );

  const stepLength =
    step.kind === "learn" ? step.cards.length : step.items.length;

  const advance = () => {
    stopSpeech();
    if (itemIdx < stepLength - 1) {
      setItemIdx((i) => i + 1);
    } else if (stepIdx < unit.steps.length - 1) {
      setStepIdx((i) => i + 1);
      setItemIdx(0);
    } else {
      setPhase("done");
    }
  };

  const [earnedXp, setEarnedXp] = useState(0);

  const registerAnswer = (isCorrect: boolean) => {
    const newCorrect = isCorrect ? correct + 1 : correct;
    if (isCorrect) setCorrect(newCorrect);

    stopSpeech();
    if (itemIdx < stepLength - 1) {
      setItemIdx((i) => i + 1);
    } else if (stepIdx < unit.steps.length - 1) {
      setStepIdx((i) => i + 1);
      setItemIdx(0);
    } else {
      const finalAccuracy =
        totalQuestions > 0
          ? Math.round((newCorrect / totalQuestions) * 100)
          : 100;

      // Завжди 10 кубків за проходження уроку
      setEarnedXp(10);

      const wordIdsToSave = unit.steps
        .filter((s) => s.kind === "learn")
        .flatMap((s) =>
          (s as { kind: "learn"; cards: WordCardData[] }).cards.map(
            (c) => c.id,
          ),
        );

      markUnitCompleted(unit.id, category.id, finalAccuracy, wordIdsToSave);
      setPhase("done");
    }
  };

  if (phase === "done") {
    const accuracy =
      totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 100;

    return (
      <CompletionScreen
        accuracy={accuracy}
        correct={correct}
        total={totalQuestions}
        xp={earnedXp}
        onContinue={() => navigate("/learning")}
      />
    );
  }

  const overallProgress =
    ((stepIdx + (itemIdx + 1) / stepLength) / unit.steps.length) * 100;

  const stepLabel =
    step.kind === "learn"
      ? "Вивчаємо слова"
      : step.kind === "quiz"
        ? "Перевірка знань"
        : step.kind === "listening"
          ? "Аудіювання"
          : step.kind === "speak"
            ? "Розмовна практика"
            : "Складання речень";

  return (
    <Screen className="!p-0 bg-[var(--bg-app)]">
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              stopSpeech();
              navigate("/learning");
            }}
            className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] active:opacity-70"
            aria-label="Закрити урок"
          >
            <X className="w-5 h-5 text-[var(--text-main)]" />
          </button>
          <div className="flex-1">
            <ProgressBar progress={overallProgress} className="!h-2.5" />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
          <span className="text-[var(--accent-cta)]">{stepLabel}</span>
          <span className="text-[var(--text-muted)]">
            {stepIdx + 1}/{unit.steps.length}
          </span>
        </div>
      </div>

      <div className="px-4 py-5 pb-32">
        {step.kind === "learn" && (
          <LearnView
            cards={step.cards}
            index={itemIdx}
            onNext={() => {
              hapticSelectNode();
              advance();
            }}
          />
        )}
        {step.kind === "quiz" && (
          <QuizView
            item={step.items[itemIdx]}
            index={itemIdx}
            total={step.items.length}
            onAnswer={registerAnswer}
          />
        )}
        {step.kind === "listening" && (
          <ListeningView
            item={step.items[itemIdx]}
            index={itemIdx}
            total={step.items.length}
            onAnswer={registerAnswer}
          />
        )}
        {step.kind === "speak" && (
          <SpeakView
            item={step.items[itemIdx]}
            index={itemIdx}
            total={step.items.length}
            onAnswer={registerAnswer}
          />
        )}
        {step.kind === "sentence" && (
          <SentenceBuildView
            item={step.items[itemIdx]}
            index={itemIdx}
            total={step.items.length}
            onAnswer={registerAnswer}
          />
        )}
      </div>
    </Screen>
  );
};
