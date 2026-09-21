import { useEffect, useState, useRef } from "react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { Bomb, User as UserIcon, AlertTriangle } from "lucide-react";
import type { DuelGameProps } from "../types";
import { useUserStore } from "../../store/userStore";

export const HotPotatoGame = ({
  myScore,
  opponentState,
  roundData,
  roundResult,
  onSubmitAction,
}: DuelGameProps) => {
  const { telegramId } = useUserStore();
  const myIdStr = telegramId?.toString() || "";

  // Читаємо хто має бомбу з кастомних даних бекенду
  const bombHolder = roundData?.bombHolder;
  const passes = roundData?.passes || 0;
  const myTurn = bombHolder === myIdStr;

  const [timeLeft, setTimeLeft] = useState(15);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);

  const timerRef = useRef<number | undefined>(undefined);

  // Скидання стейтів при початку нового раунду
  useEffect(() => {
    // З кожним пасом час зменшується на 2 сек (мінімум 3 секунди на відповідь)
    const maxTime = Math.max(3, 15 - passes * 2);
    setTimeLeft(maxTime);
    setHasAnswered(false);
    setMyAnswer(null);
  }, [roundData, passes]);

  // Таймер бомби
  useEffect(() => {
    if (!hasAnswered && !roundResult && timeLeft > 0) {
      timerRef.current = window.setTimeout(
        () => setTimeLeft((t) => t - 1),
        1000,
      );
    } else if (timeLeft === 0 && myTurn && !hasAnswered && !roundResult) {
      // Якщо мій хід і час вийшов - відправляю TIMEOUT, що означає мій програш
      handleAnswer("TIMEOUT");
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, hasAnswered, roundResult, myTurn]);

  const handleAnswer = (answer: string) => {
    if (hasAnswered || roundResult || !myTurn) return;
    setHasAnswered(true);
    setMyAnswer(answer);
    onSubmitAction(answer);
  };

  const getButtonClassName = (opt: string) => {
    const baseClass =
      "py-4 text-base sm:text-lg font-bold border-2 transition-all";

    if (!myTurn) return `${baseClass} opacity-50 border-[var(--border-color)]`;

    if (!roundResult) {
      return myAnswer === opt
        ? `${baseClass} border-red-500 bg-red-500/10 text-red-500`
        : `${baseClass} border-[var(--border-color)]`;
    }

    if (roundResult.correctAnswer === opt) {
      return `${baseClass} border-green-500 bg-green-500/10 text-green-600`;
    }
    if (myAnswer === opt && roundResult.correctAnswer !== opt) {
      return `${baseClass} border-red-500 bg-red-500/10 text-red-600`;
    }

    return `${baseClass} opacity-50 border-[var(--border-color)]`;
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto">
      {/* Шапка гравців (без рахунку, бо гра до першої помилки) */}
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border-color)] mb-4 shadow-sm">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${myTurn ? "bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : ""}`}
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-[var(--text-main)]">Ти</div>
        </div>

        <div className="text-2xl font-black text-amber-500 flex flex-col items-center">
          <Bomb
            className={`w-8 h-8 ${myTurn ? "text-red-500 animate-pulse scale-125" : opponentState.connected ? "text-red-500 scale-75" : "text-gray-500"}`}
          />
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${!myTurn ? "bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : ""}`}
        >
          <div className="text-sm font-bold text-[var(--text-main)]">
            {opponentState.nickname}
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

      {/* Таймер вибуху */}
      <div className="w-full h-4 bg-[var(--bg-card)] rounded-full mb-6 overflow-hidden border border-[var(--border-color)]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 3 ? "bg-red-600 animate-pulse" : "bg-red-500"}`}
          style={{
            width: `${(timeLeft / Math.max(3, 15 - passes * 2)) * 100}%`,
          }}
        />
      </div>

      {/* Центральна зона зі словом */}
      <Card
        className={`flex-1 flex flex-col items-center justify-center p-4 text-center mb-6 relative overflow-hidden transition-colors duration-300 ${myTurn ? "bg-red-500/10 border-red-500/50 shadow-[inset_0_0_50px_rgba(239,68,68,0.2)]" : "bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-app)]"}`}
      >
        <div className="flex-1 flex items-center justify-center w-full relative z-10">
          <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] drop-shadow-md">
            {roundData?.word || "..."}
          </h2>
        </div>

        <div className="h-6 mt-4 w-full flex justify-center items-center">
          {!myTurn && (
            <div className="flex items-center gap-2 text-sm font-bold text-red-500 animate-bounce">
              <AlertTriangle className="w-4 h-4" /> Бомба у суперника!
            </div>
          )}
          {myTurn && !hasAnswered && (
            <div className="flex items-center gap-2 text-sm font-bold text-amber-500 animate-pulse">
              Твій хід! Швидко обирай!
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
            disabled={!myTurn || hasAnswered}
            className={getButtonClassName(opt)}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
};
