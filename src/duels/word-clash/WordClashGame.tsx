import { useState, useEffect } from "react";
import type { DuelGameProps } from "../types"; // Виправлено: type-only import
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { Check, X, Clock } from "lucide-react";

// Виправлено: прибрано roomId, оскільки він не використовується
export const WordClashGame = ({
  myScore,
  opponentState,
  roundData,
  onSubmitAction,
  roundResult,
}: DuelGameProps & { roundResult?: any }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Скидаємо вибір при новому раунді
  useEffect(() => {
    if (roundData) setSelectedOption(null);
  }, [roundData]);

  const handleSelect = (option: string) => {
    if (selectedOption || roundResult) return;
    setSelectedOption(option);
    onSubmitAction(option);
  };

  if (!roundData) return null;

  return (
    <div className="flex flex-col h-full w-full space-y-4">
      {/* Статус бар (Хто відповів) */}
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${selectedOption ? "bg-[var(--accent-success)]" : "bg-amber-500 animate-pulse"}`}
          />
          <span className="font-bold text-sm text-[var(--text-main)]">
            Ви: {myScore}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[var(--text-main)]">
            {opponentState.nickname}: {opponentState.score}
          </span>
          <div
            className={`w-3 h-3 rounded-full ${opponentState.lastAction === "acted" ? "bg-[var(--accent-success)]" : "bg-amber-500 animate-pulse"}`}
          />
        </div>
      </div>

      <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 border-[var(--accent-cta)]/20 shadow-lg">
        <div className="text-[var(--text-muted)] font-bold text-sm uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4" /> На швидкість
        </div>

        <h2 className="text-4xl font-black text-[var(--text-main)] tracking-tight">
          {roundData.word}
        </h2>

        <div className="grid grid-cols-2 gap-3 w-full">
          {roundData.options.map((option: string) => {
            let btnClass = "bg-[var(--bg-app)] text-[var(--text-main)]";
            let icon = null;

            if (roundResult) {
              if (option === roundResult.correctAnswer) {
                btnClass = "bg-[var(--accent-success)] text-white border-none";
                icon = <Check className="w-5 h-5" />;
              } else if (option === selectedOption) {
                btnClass = "bg-red-500 text-white border-none";
                icon = <X className="w-5 h-5" />;
              }
            } else if (selectedOption === option) {
              btnClass =
                "bg-[var(--accent-cta)] text-white border-none opacity-80";
            }

            return (
              <Button
                key={option}
                variant="secondary"
                disabled={!!selectedOption || !!roundResult}
                onClick={() => handleSelect(option)}
                className={`py-6 text-lg font-bold flex items-center justify-center gap-2 transition-all ${btnClass}`}
              >
                {option} {icon}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Індикатор результату раунду */}
      {roundResult && (
        <div className="text-center animate-in slide-in-from-bottom-4">
          <span
            className={`inline-block px-4 py-2 rounded-full font-black text-white shadow-lg ${selectedOption === roundResult.correctAnswer ? "bg-[var(--accent-success)]" : "bg-red-500"}`}
          >
            {selectedOption === roundResult.correctAnswer
              ? "+ Бали!"
              : "Помилка"}
          </span>
        </div>
      )}
    </div>
  );
};
