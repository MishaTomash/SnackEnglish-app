import { useCallback, useState, useEffect } from "react";
import { Mic, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useSpeechRecognition } from "../lib/useSpeechRecognition";
import { calculateSimilarity } from "../lib/similarity";

interface SpeechPracticeBlockProps {
  targetText: string;
  onStatusChange: (canProceed: boolean) => void;
  threshold?: number;
  maxAttempts?: number;
}

export const SpeechPracticeBlock = ({
  targetText,
  onStatusChange,
  threshold = 70,
  maxAttempts = 3,
}: SpeechPracticeBlockProps) => {
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Скидаємо стан при зміні тексту (перехід до наступного речення)
  useEffect(() => {
    setSimilarityScore(null);
    setHasEvaluated(false);
    setAttempts(0);
    onStatusChange(false);
  }, [targetText, onStatusChange]);

  const handleSpeechEnd = useCallback(
    (finalTranscript: string) => {
      if (!finalTranscript.trim()) {
        setSimilarityScore(0);
        setHasEvaluated(true);
        setAttempts((p) => p + 1);
        return;
      }
      const score = calculateSimilarity(finalTranscript, targetText);
      setSimilarityScore(score);
      setHasEvaluated(true);
      setAttempts((p) => p + 1);
    },
    [targetText],
  );

  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: "en-US",
    onEnd: handleSpeechEnd,
  });

  const isPassed = (similarityScore ?? 0) >= threshold;
  const canSkip = attempts >= maxAttempts;
  const canProceed = isPassed || canSkip;

  // Повідомляємо батьківський компонент, чи можна йти далі
  useEffect(() => {
    if (hasEvaluated || !isSupported) {
      onStatusChange(canProceed || !isSupported);
    }
  }, [hasEvaluated, canProceed, isSupported, onStatusChange]);

  const handleMicClick = () => {
    if (isListening) stopListening();
    else {
      setHasEvaluated(false);
      setSimilarityScore(null);
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <Card className="p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-[var(--accent-error)]" />
        <h3 className="font-bold text-[var(--text-main)]">
          Розпізнавання недоступне
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Браузер не підтримує мікрофон. Повторіть фразу подумки.
        </p>
        <div className="p-4 bg-[var(--bg-app)] rounded-2xl font-bold text-lg text-[var(--text-main)]">
          "{targetText}"
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 text-center space-y-4">
      <span className="text-xs uppercase font-bold text-[var(--text-muted)]">
        Вимовіть уголос
      </span>

      <p className="text-xl font-bold text-[var(--text-main)]">
        "{targetText}"
      </p>

      {transcript && (
        <div className="p-3 bg-[var(--bg-app)] rounded-2xl text-xs space-y-1">
          <span className="text-[var(--text-muted)] font-medium">
            Ви сказали:
          </span>
          <p className="font-semibold text-[var(--text-main)] italic">
            "{transcript}"
          </p>
        </div>
      )}

      <div className="pt-2 flex flex-col items-center gap-3">
        {!isListening && !hasEvaluated && (
          <button
            onClick={handleMicClick}
            className="w-16 h-16 rounded-full bg-[var(--accent-cta)] text-[var(--text-accent)] flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Mic className="w-7 h-7" />
          </button>
        )}
        {isListening && (
          <button
            onClick={handleMicClick}
            className="w-16 h-16 rounded-full bg-[var(--accent-error)] text-white flex items-center justify-center animate-pulse shadow-lg"
          >
            <Mic className="w-7 h-7" />
          </button>
        )}

        {!isListening && hasEvaluated && (
          <div
            className={`w-full p-4 border rounded-2xl ${
              isPassed
                ? "bg-[var(--accent-success)]/10 border-[var(--accent-success)]/30"
                : "bg-[var(--accent-error)]/10 border-[var(--accent-error)]/30"
            }`}
          >
            <div
              className={`flex items-center justify-center gap-1.5 font-bold ${
                isPassed
                  ? "text-[var(--accent-success)]"
                  : "text-[var(--accent-error)]"
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <RotateCcw className="w-5 h-5" />
              )}
              <span>Збіг: {similarityScore}%</span>
            </div>

            {!isPassed && (
              <>
                {!canSkip ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleMicClick}
                    className="w-full mt-3"
                  >
                    Спробувати ще раз{" "}
                    {maxAttempts !== Infinity && `(${attempts}/${maxAttempts})`}
                  </Button>
                ) : (
                  <div className="mt-3 text-xs text-[var(--text-muted)] font-medium">
                    Ви вичерпали спроби, але можете йти далі 🍪
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
