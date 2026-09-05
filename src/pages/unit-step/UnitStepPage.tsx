// src/pages/unit/UnitStepPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { useProgressStore } from "../../store/progressStore";
import { useUserStore } from "../../store/userStore";
import { getWordsByIds } from "../../entities/word/api";
import type { Word } from "../../entities/word/types";
import type { UnitStepType } from "../../entities/unit/types";

// Імпорт всіх розбитих компонентів
import { VocabularyStep } from "./ui/VocabularyStep";
import { WarmupStep } from "./ui/WarmupStep";
import { GrammarStep } from "./ui/GrammarStep";
import { VideoStep } from "./ui/VideoStep";
import { ReadingStep } from "./ui/ReadingStep";
import { SpeakingStep } from "./ui/SpeakingStep";
import { TestStep } from "./ui/TestStep";

export const UnitStepPage = () => {
  const { unitId, stepType } = useParams<{
    unitId: string;
    stepType: UnitStepType;
  }>();
  const navigate = useNavigate();
  const { units, completeStep } = useProgressStore();
  const incrementWordsLearned = useUserStore(
    (state) => state.incrementWordsLearned,
  );

  const unit = units.find((u) => u.id === unitId);
  const [words, setWords] = useState<Word[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [isUnitFinishedModalOpen, setIsUnitFinishedModalOpen] = useState(false);

  useEffect(() => {
    if (!unit) return;
    const fetchWords = async () => {
      setIsLoadingWords(true);
      try {
        if (unit.wordIds?.length > 0) {
          const res = await getWordsByIds(unit.wordIds);
          setWords(res);
        } else setWords([]);
      } catch {
        setWords([]);
      } finally {
        setIsLoadingWords(false);
      }
    };
    fetchWords();
  }, [unit?.wordIds]);

  // ДОДАНО: підрахунок реального прогресу кроків
  const stepProgress = useMemo(() => {
    if (!unit) return { current: 0, total: 0 };
    const totalSteps = unit.steps?.length || 0;
    // Використовуємо Set, щоб не рахувати двічі один і той самий пройдений крок
    const completedUnique = new Set(unit.completedSteps || []).size;
    return { current: completedUnique, total: totalSteps };
  }, [unit]);

  if (!unit || !stepType)
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--tg-theme-hint-color,#8e8e93)]">
          Урок не знайдено
        </p>
      </Screen>
    );

  const handleComplete = () => {
    completeStep(unit.id, stepType);
    if (stepType === "vocabulary") incrementWordsLearned(words.length);

    if (stepType === "test") setIsUnitFinishedModalOpen(true);
    else navigate(`/path/${unit.id}`);
  };

  if (isUnitFinishedModalOpen) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[var(--tg-theme-text-color,#000000)]">
            Юніт завершено! 🎉
          </h1>
          <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
            Ви успішно пройшли всі кроки теми «{unit.title}». Наступний юніт
            розблоковано!
          </p>
        </div>
        <Button
          onClick={() => navigate("/")}
          variant="primary"
          className="w-full"
        >
          На Головну
        </Button>
      </Screen>
    );
  }

  return (
    <Screen className="justify-between">
      {/* ОНОВЛЕНО: Хедер із відображенням прогресу "X з N кроків пройдено" */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--tg-theme-hint-color,#d1d5db)]/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/path/${unit.id}`)}
            className="p-2 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000000)] transition-colors active:opacity-70"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[var(--tg-theme-hint-color,#8e8e93)]">
              {stepProgress.current} з {stepProgress.total} кроків пройдено
            </span>
          </div>
        </div>
        <Badge className="text-xs uppercase bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000000)]">
          {stepType}
        </Badge>
      </div>

      {stepType === "warmup" && (
        <WarmupStep unit={unit} onComplete={handleComplete} />
      )}
      {stepType === "vocabulary" && (
        <VocabularyStep
          words={words}
          isLoading={isLoadingWords}
          onComplete={handleComplete}
        />
      )}
      {stepType === "grammar" && (
        <GrammarStep unit={unit} onComplete={handleComplete} />
      )}
      {stepType === "video" && (
        <VideoStep unit={unit} onComplete={handleComplete} />
      )}
      {stepType === "reading" && (
        <ReadingStep unit={unit} onComplete={handleComplete} />
      )}
      {stepType === "speaking" && (
        <SpeakingStep words={words} onComplete={handleComplete} />
      )}
      {stepType === "test" && (
        <TestStep words={words} onComplete={handleComplete} />
      )}

      <div />
    </Screen>
  );
};
