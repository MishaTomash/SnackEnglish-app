import { useState } from "react";
import { Volume2, AlertCircle } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { ProgressBar } from "../../../shared/ui/ProgressBar";
import type { Word } from "../../../entities/word/types";

interface Props {
  words: Word[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onComplete: () => void;
}

export const VocabularyStep = ({
  words,
  isLoading,
  error,
  onRetry,
  onComplete,
}: Props) => {
  const [vocabIndex, setVocabIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-sm text-[var(--text-muted)] animate-pulse">
          Завантаження слів...
        </div>
      </div>
    );
  }

  if (error || words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-error)]/10 text-[var(--accent-error)] flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm text-[var(--text-muted)] px-4">
          {error || "Слів для цього уроку не знайдено."}
        </p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry} className="mt-4 px-8">
            Спробувати ще раз
          </Button>
        )}
      </div>
    );
  }

  const word = words[vocabIndex];
  const isLastWord = vocabIndex === words.length - 1;

  const playAudio = (text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-4 my-auto">
      <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-muted)]">
        <span>
          Слово {vocabIndex + 1} з {words.length}
        </span>
      </div>
      <ProgressBar progress={((vocabIndex + 1) / words.length) * 100} />

      <Card className="p-6 text-center space-y-4 min-h-[260px] flex flex-col justify-center">
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl font-extrabold text-[var(--text-main)]">
            {word.text}
          </span>
          <button
            onClick={() => playAudio(word.text)}
            className="p-3 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-full hover:bg-[var(--accent-cta)]/20 active:scale-95 transition-transform"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
        <span className="text-sm text-[var(--text-muted)] font-mono">
          {word.transcription}
        </span>
        <div className="text-xl font-semibold text-[var(--accent-cta)]">
          {word.translation}
        </div>
      </Card>

      <div className="flex gap-2">
        {vocabIndex > 0 && (
          <Button
            variant="secondary"
            onClick={() => setVocabIndex((p) => p - 1)}
            className="w-1/3"
          >
            Назад
          </Button>
        )}
        <Button
          variant="primary"
          className="flex-1"
          onClick={() =>
            isLastWord ? onComplete() : setVocabIndex((p) => p + 1)
          }
        >
          {isLastWord ? "Завершити" : "Далі"}
        </Button>
      </div>
    </div>
  );
};
