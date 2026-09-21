import { useEffect, useState } from "react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { User as UserIcon, Lock } from "lucide-react";
import type { DuelGameProps } from "../types";

export const TugOfWarGame = ({
  myScore,
  opponentState,
  roundData,
  roundResult,
  onSubmitAction,
}: DuelGameProps) => {
  const [typedText, setTypedText] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [oppTypedCount, setOppTypedCount] = useState(0);

  const targetWord = roundData?.wordEn || "";
  const targetTranslation = roundData?.wordUa || "";

  // Скидаємо стейт при новому раунді
  useEffect(() => {
    setTypedText("");
    setIsBlocked(false);
    setOppTypedCount(0);
  }, [roundData]);

  // Слідкуємо за діями суперника
  useEffect(() => {
    if (opponentState.lastAction?.isCorrect) {
      setOppTypedCount((prev) => prev + 1);
    }
  }, [opponentState.lastAction]);

  const handleKeyPress = (key: string) => {
    if (isBlocked || roundResult || typedText.length >= targetWord.length)
      return;

    const expectedChar = targetWord[typedText.length];

    if (key === expectedChar) {
      setTypedText((prev) => prev + key);
      onSubmitAction(key);
    } else {
      // Штраф за неправильну літеру
      setIsBlocked(true);
      setTimeout(() => setIsBlocked(false), 1000);
    }
  };

  // Розрахунок позиції канату (50% - центр)
  const myProgress = typedText.length;
  const maxChars = targetWord.length || 1;
  // Різниця прогресу (від -1 до 1)
  const difference = (myProgress - oppTypedCount) / maxChars;
  // Конвертуємо у відсотки позиції (від 10% до 90% для краси)
  const ropePosition = 50 + difference * 40;

  const keyboardRows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto">
      {/* Рахунок */}
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

      {/* Візуальний Канат */}
      <div className="relative w-full h-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center px-4 overflow-hidden mb-6">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[var(--accent-cta)]/20 -translate-x-1/2"></div>
        <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-red-500/50 via-slate-500 to-blue-500/50 top-1/2 -translate-y-1/2 z-0"></div>

        {/* Вузол канату */}
        <div
          className="absolute w-8 h-8 bg-[var(--accent-cta)] rounded-full border-4 border-[var(--bg-app)] shadow-lg z-10 transition-all duration-300 ease-out -ml-4"
          style={{ left: `${Math.max(5, Math.min(95, ropePosition))}%` }}
        />
      </div>

      {/* Слово для введення */}
      <Card
        className={`flex-1 flex flex-col items-center justify-center p-6 text-center mb-4 transition-colors ${isBlocked ? "bg-red-500/10 border-red-500/50" : "bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-app)]"}`}
      >
        <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-muted)] mb-4">
          {targetTranslation}
        </h3>

        <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center mt-2">
          {targetWord.split("").map((char: string, idx: number) => {
            const isTyped = idx < typedText.length;
            const isOppTyped = idx < oppTypedCount;

            return (
              <div
                key={idx}
                className={`relative w-8 h-10 sm:w-10 sm:h-12 flex items-center justify-center text-xl sm:text-2xl font-black rounded-lg border-b-4 ${isTyped ? "bg-blue-500 text-white border-blue-600" : "bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border-color)]"}`}
              >
                {isTyped ? char : ""}
                {/* Індикатор, що суперник вже написав цю літеру */}
                {isOppTyped && !isTyped && (
                  <div className="absolute -bottom-1 w-full h-1 bg-red-500 rounded-full opacity-50" />
                )}
              </div>
            );
          })}
        </div>

        {isBlocked && (
          <div className="absolute bottom-4 flex items-center gap-2 text-red-500 font-bold animate-bounce">
            <Lock className="w-5 h-5" /> Штраф 1 сек!
          </div>
        )}
      </Card>

      {/* Екранна клавіатура */}
      <div className="flex flex-col gap-2 shrink-0 pb-2">
        {keyboardRows.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1 sm:gap-2">
            {row.map((key) => (
              <Button
                key={key}
                variant={isBlocked ? "danger" : "secondary"}
                disabled={isBlocked || !!roundResult}
                onClick={() => handleKeyPress(key)}
                className={`min-w-[2rem] h-12 sm:min-w-[2.8rem] sm:h-14 p-0 text-base sm:text-lg font-black transition-transform ${isBlocked ? "opacity-50" : "active:scale-95"}`}
              >
                {key}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
