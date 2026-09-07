import { useState, useMemo } from "react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import type { Unit } from "../../../entities/unit/types";
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock";

export const ReadingStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [canProceed, setCanProceed] = useState(false);

  const unitData = unit as any;
  const readingBlock = unitData.steps?.reading || unitData.reading || {};

  const title = readingBlock.title || "Прочитайте текст:";
  const text = readingBlock.text || unitData.readingText || "";
  const translation = readingBlock.translation || unitData.readingTranslation;

  // Розбиваємо текст на речення за розділовими знаками
  const sentences = useMemo(() => {
    if (!text) return [];
    const matched = text.match(/[^.!?]+[.!?]+["']?/g);
    if (matched && matched.length > 0) {
      return matched.map((s: string) => s.trim()).filter(Boolean);
    }
    return [text.trim()]; // Фолбек, якщо немає розділових знаків
  }, [text]);

  const currentSentence = sentences[currentSentenceIdx];

  const handleNext = () => {
    if (currentSentenceIdx < sentences.length - 1) {
      setCurrentSentenceIdx((p) => p + 1);
      setCanProceed(false);
    } else {
      onComplete();
    }
  };

  if (!currentSentence) {
    return (
      <Button onClick={onComplete} variant="primary" className="w-full">
        Завершити читання
      </Button>
    );
  }

  return (
    <div className="space-y-4 my-auto pb-4">
      <Card className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-base">{title}</h3>
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            Речення {currentSentenceIdx + 1} з {sentences.length}
          </span>
        </div>

        <p className="text-base leading-relaxed tracking-wide text-[var(--text-muted)]">
          {sentences.map((s: string, idx: number) => (
            <span
              key={idx}
              className={
                idx === currentSentenceIdx
                  ? "text-[var(--text-main)] font-bold bg-[var(--accent-cta)]/20 rounded px-1 transition-colors"
                  : ""
              }
            >
              {s}{" "}
            </span>
          ))}
        </p>

        {showTranslation && translation && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm leading-relaxed">
            {translation}
          </div>
        )}
        {translation && (
          <Button
            variant="secondary"
            onClick={() => setShowTranslation(!showTranslation)}
            className="py-2 text-xs w-full"
          >
            {showTranslation ? "Сховати переклад" : "Показати переклад"}
          </Button>
        )}
      </Card>

      <SpeechPracticeBlock
        targetText={currentSentence}
        onStatusChange={setCanProceed}
        threshold={70}
        maxAttempts={3}
      />

      <Button
        onClick={handleNext}
        variant="primary"
        className="w-full"
        disabled={!canProceed}
      >
        {currentSentenceIdx < sentences.length - 1
          ? "Наступне речення"
          : "Завершити читання"}
      </Button>
    </div>
  );
};
