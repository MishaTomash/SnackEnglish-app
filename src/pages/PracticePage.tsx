import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CalendarCheck, RotateCcw, AlertCircle } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { useRepetitionStore } from "../store/repetitionStore";
import type { PracticeItem } from "../entities/learning/types";

export const PracticePage = () => {
  const navigate = useNavigate();

  const {
    dailyQueue,
    currentWordIndex,
    status,
    error,
    isFinished,
    loadDailyWords,
    submitReview,
  } = useRepetitionStore();

  const [isRevealed, setIsRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadDailyWords();
  }, [loadDailyWords]);

  const currentItem = dailyQueue[currentWordIndex];
  const totalDueToday = dailyQueue.length;

  const handleAnswer = async (remembered: boolean) => {
    if (!currentItem || isSubmitting) return;
    setIsSubmitting(true);

    const quality = remembered ? 4 : 1;
    setIsRevealed(false);
    await submitReview(quality);

    setIsSubmitting(false);
  };

  if (status === "loading" || status === "idle") {
    return (
      <Screen className="justify-center items-center">
        <p className="text-sm text-[var(--text-muted)] animate-pulse">
          Завантаження черги повторення...
        </p>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-full bg-[var(--accent-error)]/10 text-[var(--accent-error)] flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Ой, халепа!</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            {error ||
              "Не вдалося завантажити матеріали. Можливо, проблеми з мережею."}
          </p>
        </div>
        <Button
          onClick={() => void loadDailyWords()}
          variant="primary"
          className="max-w-xs"
        >
          Спробувати ще раз
        </Button>
      </Screen>
    );
  }

  if (isFinished || totalDueToday === 0 || !currentItem) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-full bg-[var(--accent-success)]/10 text-[var(--accent-success)] flex items-center justify-center mx-auto">
          <CalendarCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Чудова робота!</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            Сьогодні нічого повторювати, смакуй свої знання і повертайся завтра.
          </p>
        </div>
        <Button
          onClick={() => navigate("/")}
          variant="primary"
          className="max-w-xs"
        >
          На головну
        </Button>
      </Screen>
    );
  }

  const progressPercent = Math.round(
    ((currentWordIndex + 1) / totalDueToday) * 100,
  );

  const getCardContent = (item: PracticeItem) => {
    switch (item.type) {
      case "quiz":
        return {
          front: item.question,
          back: item.correctAnswer,
          badge: "Тест",
        };
      case "sentence":
        return {
          front: item.translation,
          back: item.correctSentence,
          badge: "Речення",
        };
      case "speaking":
        return {
          front: item.translation,
          back: item.phrase,
          badge: "Говоріння",
        };
      case "listening":
        return {
          front: item.phrase,
          back: item.correctAnswer,
          badge: "Аудіювання",
        };
      case "word":
      default:
        return {
          front: item.word,
          back: item.translation,
          sub: item.transcription,
          badge: "Слово",
        };
    }
  };

  const content = getCardContent(currentItem);

  return (
    <Screen className="justify-between space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-muted)]">
          <span>
            Завдання {currentWordIndex + 1} з {totalDueToday}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <ProgressBar progress={progressPercent} />
      </div>

      <div className="my-auto">
        <Card
          onClick={() => setIsRevealed((prev) => !prev)}
          className="p-6 text-center cursor-pointer min-h-[300px] flex flex-col justify-center items-center space-y-4 border border-[var(--border-color)] active:scale-[0.99] transition-transform select-none shadow-sm"
        >
          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-muted)] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> {content.badge}
          </span>

          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold">{content.front}</h1>
            {content.sub && (
              <p className="text-sm text-[var(--text-muted)] font-mono">
                {content.sub}
              </p>
            )}
          </div>

          {isRevealed ? (
            <div className="space-y-3 pt-4 border-t border-[var(--border-color)]/50 w-full">
              <div className="text-2xl font-bold text-[var(--accent-cta)]">
                {content.back}
              </div>
            </div>
          ) : (
            <div className="pt-8 text-xs text-[var(--text-muted)] flex items-center gap-1.5 opacity-70">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Натисніть для перекладу</span>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-2">
        {isRevealed ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              disabled={isSubmitting}
              onClick={() => void handleAnswer(false)}
              className="py-3 text-sm font-bold"
            >
              Не пам'ятаю
            </Button>
            <Button
              variant="primary"
              disabled={isSubmitting}
              onClick={() => void handleAnswer(true)}
              className="py-3 text-sm font-bold"
            >
              Пам'ятаю
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setIsRevealed(true)}
            className="w-full py-3 text-sm font-bold"
          >
            Показати відповідь
          </Button>
        )}
      </div>
    </Screen>
  );
};
