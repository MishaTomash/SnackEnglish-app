import { useEffect, useState, useMemo, useCallback } from "react";
import {
  useParams,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { ArrowLeft, Trophy, Crown, Sparkles } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { useProgressStore } from "../../store/progressStore";
import { useUserStore } from "../../store/userStore";
import { getWordsByIds } from "../../entities/word/api";
import type { Word, EnglishLevel } from "../../entities/word/types";
import type { UnitStepType } from "../../entities/unit/types";

import { VocabularyStep } from "./ui/VocabularyStep";
import { WarmupStep } from "./ui/WarmupStep";
import { GrammarStep } from "./ui/GrammarStep";
import { VideoStep } from "./ui/VideoStep";
import { ReadingStep } from "./ui/ReadingStep";
import { SpeakingStep } from "./ui/SpeakingStep";
import { TestStep } from "./ui/TestStep";

// Допоміжна функція для визначення наступного рівня
const getNextLevel = (current: EnglishLevel): EnglishLevel | null => {
  const levels: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const idx = levels.indexOf(current);
  if (idx !== -1 && idx < levels.length - 1) return levels[idx + 1];
  return null;
};

export const UnitStepPage = () => {
  const { unitId, stepType } = useParams<{
    unitId: string;
    stepType: UnitStepType;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { units, completeStep } = useProgressStore();
  const { incrementWordsLearned, level, updateLevel } = useUserStore();

  const unit = units.find((u) => u.id === unitId);
  const [words, setWords] = useState<Word[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [isUnitFinishedModalOpen, setIsUnitFinishedModalOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Перевіряємо, чи це останній юніт у масиві
  const isLastUnitInCourse = useMemo(() => {
    if (units.length === 0 || !unit) return false;
    return units[units.length - 1].id === unit.id;
  }, [units, unit]);

  const returnPath = location.state?.from || `/path/${unit?.id}`;

  const fetchWords = useCallback(async () => {
    if (!unit) return;
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
  }, [unit]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const stepsList = useMemo(() => {
    if (!unit) return [];
    if (Array.isArray(unit.steps) && unit.steps.length > 0) {
      return unit.steps.map((s: any) => s.type);
    }
    if (
      unit.steps &&
      typeof unit.steps === "object" &&
      Object.keys(unit.steps).length > 0
    ) {
      return Object.keys(unit.steps) as UnitStepType[];
    }
    const dynamicSteps: UnitStepType[] = ["warmup"];
    if (unit.wordIds?.length > 0) dynamicSteps.push("vocabulary", "speaking");
    if (unit.grammarTopic || unit.grammar?.title) dynamicSteps.push("grammar");
    if (unit.videoUrl) dynamicSteps.push("video");
    if (unit.readingText) dynamicSteps.push("reading");
    dynamicSteps.push("test");
    return dynamicSteps;
  }, [unit]);

  const isStepAccessible = useMemo(() => {
    if (!unit || !stepType) return false;
    const completedSteps = unit.completedSteps || [];
    if (completedSteps.includes(stepType)) return true;
    const firstUncompleted = stepsList.find(
      (type) => !completedSteps.includes(type),
    );
    return firstUncompleted === stepType;
  }, [unit, stepType, stepsList]);

  const stepProgress = useMemo(() => {
    if (!unit) return { current: 0, total: 0 };
    const completedUnique = new Set(unit.completedSteps || []).size;
    return { current: completedUnique, total: stepsList.length };
  }, [unit, stepsList.length]);

  if (!unit || !stepType)
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--text-muted)]">Урок не знайдено</p>
      </Screen>
    );

  if (!isStepAccessible) {
    return <Navigate to={`/path/${unit.id}`} replace />;
  }

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      await completeStep(unit.id, stepType);
      if (stepType === "vocabulary") {
        incrementWordsLearned(words.length);
      }
      if (stepType === "test") {
        setIsUnitFinishedModalOpen(true);
      } else if (stepType === "warmup") {
        const currentIndex = stepsList.indexOf(stepType);
        const nextStep = stepsList[currentIndex + 1];
        if (nextStep) {
          navigate(`/unit/${unit.id}/step/${nextStep}`, { replace: true });
        } else {
          navigate(`/path/${unit.id}`);
        }
      } else {
        navigate(`/path/${unit.id}`);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  if (isUnitFinishedModalOpen) {
    const nextLevel = level ? getNextLevel(level) : null;

    // ГРАНДІОЗНИЙ ФІНАЛ КУРСУ
    if (isLastUnitInCourse) {
      return (
        <Screen className="justify-center items-center text-center p-6 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-[var(--accent-cta)] blur-3xl opacity-30 rounded-full" />
            <div className="relative w-32 h-32 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-full flex flex-col items-center justify-center animate-bounce shadow-[0_0_40px_rgba(232,163,61,0.2)]">
              <Crown className="w-16 h-16" />
              <Sparkles className="absolute top-2 right-2 w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-[var(--accent-cta)] drop-shadow-md">
              Курс завершено! 🎉
            </h1>
            <p className="text-sm font-medium text-[var(--text-muted)] px-4">
              Ти пройшов усі теми рівня{" "}
              <span className="text-[var(--text-main)] font-bold">{level}</span>
              . Твій словниковий запас та розуміння граматики вийшли на новий
              рівень. Ти неймовірний!
            </p>
          </div>
          {nextLevel ? (
            <Button
              onClick={async () => {
                await updateLevel(nextLevel);
                navigate("/");
              }}
              variant="primary"
              className="w-full h-14 text-lg shadow-lg active:scale-95 transition-transform"
            >
              Перейти на рівень {nextLevel}
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/")}
              variant="primary"
              className="w-full"
            >
              На Головну
            </Button>
          )}
        </Screen>
      );
    }

    // СТАНДАРТНЕ ЗАВЕРШЕННЯ ЮНІТА
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-20 h-20 bg-[var(--accent-success)]/10 text-[var(--accent-success)] rounded-full flex items-center justify-center animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[var(--text-main)]">
            Юніт завершено! 🎉
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Ви успішно пройшли всі кроки теми «{unit.title}». Наступний юніт
            розблоковано!
          </p>
        </div>
        <Button
          onClick={() => navigate(returnPath === "/" ? "/" : "/path")}
          variant="primary"
          className="w-full"
        >
          {returnPath === "/" ? "На Головну" : "На Карту"}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      className={`justify-between transition-opacity duration-200 ${isCompleting ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(returnPath)}
            className="p-2 rounded-2xl bg-[var(--bg-card)] text-[var(--text-main)] transition-colors active:opacity-70 border border-[var(--border-color)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {stepProgress.current} з {stepProgress.total} кроків пройдено
            </span>
          </div>
        </div>
        <Badge className="text-xs uppercase">{stepType}</Badge>
      </div>

      {stepType === "warmup" && (
        <WarmupStep unit={unit} onComplete={handleComplete} />
      )}
      {stepType === "vocabulary" && (
        <VocabularyStep
          words={words}
          isLoading={isLoadingWords}
          onComplete={handleComplete}
          onRetry={fetchWords}
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
    </Screen>
  );
};
