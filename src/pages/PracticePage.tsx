import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, Sparkles, CalendarCheck, RotateCcw } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { useProgressStore } from "../store/progressStore";
import { useRepetitionStore } from "../store/repetitionStore";
import { getWordsByIds } from "../entities/word/api";
import type { Word } from "../entities/word/types";

export const PracticePage = () => {
  const navigate = useNavigate();

  const units = useProgressStore((state) => state.units);
  const { items, initWordsFromCompletedUnits, recordReview } =
    useRepetitionStore();

  const [wordsMap, setWordsMap] = useState<Record<string, Word>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 1. Збираємо всі wordIds із завершених юнітів
  const completedWordIds = useMemo(() => {
    return units
      .filter((u) => u.status === "completed")
      .flatMap((u) => u.wordIds);
  }, [units]);

  // 2. Ініціалізуємо нові слова в SM-2 чергу
  useEffect(() => {
    if (completedWordIds.length > 0) {
      initWordsFromCompletedUnits(completedWordIds);
    }
  }, [completedWordIds, initWordsFromCompletedUnits]);

  // 3. Завантажуємо сутності слів
  useEffect(() => {
    if (completedWordIds.length === 0) {
      setIsLoading(false);
      return;
    }

    getWordsByIds(completedWordIds).then((fetchedWords) => {
      const map: Record<string, Word> = {};
      fetchedWords.forEach((w) => {
        map[w.id] = w;
      });
      setWordsMap(map);
      setIsLoading(false);
    });
  }, [completedWordIds]);

  // 4. Фільтруємо слова, у яких nextReviewDate <= зараз
  const dueWordIds = useMemo(() => {
    const now = Date.now();
    return completedWordIds.filter((id) => {
      const repItem = items[id];
      if (!repItem) return true;
      return new Date(repItem.nextReviewDate).getTime() <= now;
    });
  }, [completedWordIds, items]);

  const currentWordId = dueWordIds[currentIndex];
  const currentWord = currentWordId ? wordsMap[currentWordId] : null;
  const totalDueToday = dueWordIds.length;

  const handleAnswer = (remembered: boolean) => {
    if (!currentWordId) return;

    // SM-2: "Не пам'ятаю" = quality 1, "Пам'ятаю" = quality 4
    const quality = remembered ? 4 : 1;
    recordReview(currentWordId, quality);

    setIsRevealed(false);
    if (currentIndex < dueWordIds.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  if (isLoading) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
          Завантаження черги повторення...
        </p>
      </Screen>
    );
  }

  // Порожній стан: немає слів на сьогодні
  if (!currentWord || totalDueToday === 0) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <CalendarCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold">Чудова робота!</h2>
          <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)] max-w-xs">
            Сьогодні нічого повторювати, повертайся завтра.
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
    ((currentIndex + 1) / totalDueToday) * 100,
  );

  return (
    <Screen className="justify-between space-y-4">
      {/* Верхній прогрес сесії */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-[var(--tg-theme-hint-color,#8e8e93)]">
          <span>
            Слово {currentIndex + 1} з {totalDueToday}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <ProgressBar progress={progressPercent} />
      </div>

      {/* Флешкартка */}
      <div className="my-auto">
        <Card
          onClick={() => setIsRevealed((prev) => !prev)}
          className="p-6 text-center cursor-pointer min-h-[300px] flex flex-col justify-center items-center space-y-4 border border-[var(--tg-theme-hint-color,#8e8e93)]/20 active:scale-[0.99] transition-transform select-none shadow-sm"
        >
          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--tg-theme-hint-color,#8e8e93)] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Флешкартка
          </span>

          {/* Слово та транскрипція */}
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold">{currentWord.text}</h1>
            <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)] font-mono">
              {currentWord.transcription}
            </p>
          </div>

          {/* Контент зворотного боку картки */}
          {isRevealed ? (
            <div className="space-y-3 pt-4 border-t border-[var(--tg-theme-hint-color,#8e8e93)]/20 w-full animate-fadeIn">
              <div className="text-2xl font-bold text-[var(--tg-theme-button-color,#3390ec)]">
                {currentWord.translation}
              </div>
              <div className="bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]/60 p-3 rounded-xl text-left space-y-1 text-sm">
                <p className="font-medium">"{currentWord.exampleSentence}"</p>
                <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
                  {currentWord.exampleTranslation}
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-8 text-xs text-[var(--tg-theme-hint-color,#8e8e93)] flex items-center gap-1.5 opacity-70">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Натисніть для перекладу</span>
            </div>
          )}
        </Card>
      </div>

      {/* Кнопки оцінки відповіді */}
      <div className="space-y-2">
        {isRevealed ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              onClick={() => handleAnswer(false)}
              className="py-3 text-sm font-bold"
            >
              Не пам'ятаю
            </Button>
            <Button
              variant="primary"
              onClick={() => handleAnswer(true)}
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
