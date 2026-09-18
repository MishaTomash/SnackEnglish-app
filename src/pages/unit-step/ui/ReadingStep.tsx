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
  const lines = readingBlock.lines || [];

  const sentences = useMemo(() => {
    if (lines.length > 0) return lines;

    // Фолбек для старого формату (якщо text - рядок)
    const oldText = readingBlock.text || unitData.readingText || "";
    const matched = oldText.match(/[^.!?]+[.!?]+["']?/g);
    if (matched && matched.length > 0) {
      return matched.map((s: string) => ({ text: s.trim(), translation: "" }));
    }
    if (oldText) return [{ text: oldText.trim(), translation: "" }];

    return [];
  }, [lines, readingBlock.text, unitData.readingText]);

  const currentSentenceObj = sentences[currentSentenceIdx];

  const handleNext = () => {
    if (currentSentenceIdx < sentences.length - 1) {
      setCurrentSentenceIdx((p) => p + 1);
      setCanProceed(false);
      setShowTranslation(false);
    } else {
      onComplete();
    }
  };

  if (!currentSentenceObj) {
    return (
      <Button onClick={onComplete} variant="primary" className="w-full">
        Завершити читання
      </Button>
    );
  }

  const globalTranslation =
    readingBlock.translation || unitData.readingTranslation;
  const displayTranslation =
    currentSentenceObj.translation || globalTranslation;

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
          {sentences.map((s: any, idx: number) => (
            <span
              key={idx}
              className={
                idx === currentSentenceIdx
                  ? "text-[var(--text-main)] font-bold bg-[var(--accent-cta)]/20 rounded px-1 transition-colors"
                  : ""
              }
            >
              {s.text}{" "}
            </span>
          ))}
        </p>

        {showTranslation && displayTranslation && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm leading-relaxed animate-in fade-in">
            {displayTranslation}
          </div>
        )}
        {displayTranslation && (
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
        targetText={currentSentenceObj.text}
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
