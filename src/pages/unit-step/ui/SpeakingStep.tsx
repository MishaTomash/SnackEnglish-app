import { useState, useMemo } from "react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import type { Unit } from "../../../entities/unit/types";
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock";

export const SpeakingStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [canProceed, setCanProceed] = useState(false);

  const speakingBlock = (unit as any).steps?.speaking || {};
  const lines = speakingBlock.lines || [];

  const practiceLines = useMemo(() => {
    if (lines.length === 0) return [];
    // Якщо це діалог, вибираємо репліки користувача ("You")
    const youLines = lines.filter(
      (l: any) => l.speaker === "You" || !l.speaker,
    );
    return youLines.length > 0 ? youLines : lines;
  }, [lines]);

  const currentLine = practiceLines[currentLineIdx];

  const handleNext = () => {
    if (currentLineIdx < practiceLines.length - 1) {
      setCurrentLineIdx((p) => p + 1);
      setCanProceed(false);
    } else {
      onComplete();
    }
  };

  if (!currentLine) {
    return (
      <div className="text-center p-6 space-y-4">
        <p className="text-[var(--text-muted)]">Немає речень для говоріння.</p>
        <Button onClick={onComplete} variant="primary" className="w-full">
          Завершити
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 my-auto pb-4 w-full">
      <ProgressBar progress={(currentLineIdx / practiceLines.length) * 100} />

      <Card className="p-6 space-y-4 text-center animate-in fade-in slide-in-from-right-4">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">
          {speakingBlock.title || "Практика вимови"} ({currentLineIdx + 1} з{" "}
          {practiceLines.length})
        </span>
        {speakingBlock.scenario && (
          <p className="text-[var(--text-muted)] text-sm mb-4 border-b border-[var(--border-color)] pb-2">
            {speakingBlock.scenario}
          </p>
        )}
        <h2 className="text-xl font-bold text-[var(--text-main)] leading-relaxed">
          {currentLine.text}
        </h2>
        {currentLine.translation && (
          <p className="text-sm text-[var(--text-muted)] italic mt-2">
            "{currentLine.translation}"
          </p>
        )}
      </Card>

      <SpeechPracticeBlock
        targetText={currentLine.expectedPhrase || currentLine.text}
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
        {currentLineIdx < practiceLines.length - 1
          ? "Наступне речення"
          : "Завершити говоріння"}
      </Button>
    </div>
  );
};
