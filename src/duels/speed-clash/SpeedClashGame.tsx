import { useEffect, useState, useRef } from "react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { BrainCircuit, Timer, User as UserIcon } from "lucide-react";
import type { DuelGameProps } from "../types";

export const SpeedClashGame = ({
  myScore,
  opponentState,
  roundData,
  roundResult,
  onSubmitAction,
}: DuelGameProps) => {
  const [timeLeft, setTimeLeft] = useState(10);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);

  const timerRef = useRef<number | undefined>(undefined);

  // Скидання стейтів при початку нового раунду
  useEffect(() => {
    setTimeLeft(10);
    setHasAnswered(false);
    setMyAnswer(null);
  }, [roundData]);

  // Таймер на 10 секунд
  useEffect(() => {
    if (!hasAnswered && !roundResult && timeLeft > 0) {
      timerRef.current = window.setTimeout(
        () => setTimeLeft((t) => t - 1),
        1000,
      );
    } else if (timeLeft === 0 && !hasAnswered && !roundResult) {
      handleAnswer(""); // Тайм-аут
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, hasAnswered, roundResult]);

  const handleAnswer = (answer: string) => {
    if (hasAnswered || roundResult) return;
    setHasAnswered(true);
    setMyAnswer(answer);
    onSubmitAction(answer);
  };

  const getButtonClassName = (opt: string) => {
    const baseClass =
      "py-4 text-base sm:text-lg font-bold border-2 transition-all";

    // Поки результату немає
    if (!roundResult) {
      return myAnswer === opt
        ? `${baseClass} border-[var(--accent-cta)] bg-[var(--accent-cta)]/10 text-[var(--accent-cta)]`
        : `${baseClass} border-[var(--border-color)]`;
    }

    // Коли прийшов результат з бекенду
    if (roundResult.correctAnswer === opt) {
      return `${baseClass} border-green-500 bg-green-500/10 text-green-600 shadow-[0_0_15px_rgba(34,197,94,0.3)]`;
    }
    if (myAnswer === opt && roundResult.correctAnswer !== opt) {
      return `${baseClass} border-red-500 bg-red-500/10 text-red-600`;
    }

    return `${baseClass} opacity-50 border-[var(--border-color)]`;
  };

  const opponentAnswered = opponentState.lastAction === "acted" && !roundResult;

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto">
      {/* Шапка з рахунком гравців */}
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border-color)] mb-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] font-bold">Ти</div>
            <div className="text-lg font-black text-[var(--text-main)]">
              {myScore}
            </div>
          </div>
        </div>

        <div className="text-xl font-black text-[var(--text-muted)] opacity-50">
          VS
        </div>

        <div className="flex items-center gap-2 text-right">
          <div>
            <div className="text-xs text-[var(--text-muted)] font-bold">
              {opponentState.nickname}
            </div>
            <div className="text-lg font-black text-[var(--text-main)]">
              {opponentState.score}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center overflow-hidden">
            {opponentState.avatar ? (
              <img
                src={opponentState.avatar}
                alt="opp"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Таймер */}
      <div className="w-full h-2 bg-[var(--bg-card)] rounded-full mb-6 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 3 ? "bg-red-500" : "bg-[var(--accent-cta)]"}`}
          style={{ width: `${(timeLeft / 10) * 100}%` }}
        />
      </div>

      {/* Центральна зона зі словом */}
      <Card className="flex-1 flex flex-col items-center justify-center p-4 text-center mb-6 relative overflow-hidden bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-app)]">
        <BrainCircuit className="w-12 h-12 text-[var(--accent-cta)]/20 absolute top-4 right-4" />

        {/* ВИПРАВЛЕНО: Зроблено контейнер для слова, щоб воно займало вільне місце */}
        <div className="flex-1 flex items-center justify-center w-full">
          <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] drop-shadow-md">
            {roundData?.word || "..."}
          </h2>
        </div>

        {/* ВИПРАВЛЕНО: Статус очікування тепер у потоці (без absolute), щоб не накладався на текст */}
        <div className="h-6 mt-4 w-full flex justify-center items-center">
          {hasAnswered && !roundResult && (
            <div className="flex items-center gap-2 text-sm font-bold text-amber-500 animate-pulse">
              <Timer className="w-4 h-4" /> Очікуємо суперника...
            </div>
          )}
          {opponentAnswered && !hasAnswered && (
            <div className="flex items-center gap-2 text-sm font-bold text-red-500 animate-bounce">
              Суперник вже відповів! 🔥
            </div>
          )}
        </div>
      </Card>

      {/* Кнопки з варіантами */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 pb-4">
        {roundData?.options?.map((opt: string, idx: number) => (
          <Button
            key={idx}
            variant="secondary"
            onClick={() => handleAnswer(opt)}
            disabled={hasAnswered}
            className={getButtonClassName(opt)}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
};
