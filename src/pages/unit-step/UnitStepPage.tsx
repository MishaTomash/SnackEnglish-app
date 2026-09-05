import { useEffect, useState, useMemo, useCallback } from "react";
import {
  useParams,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { useProgressStore } from "../../store/progressStore";
import { useUserStore } from "../../store/userStore";
import { getWordsByIds } from "../../entities/word/api";
import type { Word } from "../../entities/word/types";
import type { UnitStepType } from "../../entities/unit/types";

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
  const location = useLocation();
  const { units, completeStep } = useProgressStore();
  const incrementWordsLearned = useUserStore(
    (state) => state.incrementWordsLearned,
  );

  const unit = units.find((u) => u.id === unitId);
  const [words, setWords] = useState<Word[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [isUnitFinishedModalOpen, setIsUnitFinishedModalOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Визначаємо шлях повернення з переданого state, або фолбек на сторінку юніта
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

  // ЗАХИСТ ВІД ПРЯМОГО ПЕРЕХОДУ (STEP-GATING)
  const isStepAccessible = useMemo(() => {
    if (!unit || !stepType) return false;

    // Збираємо список усіх кроків, аналогічно до логіки stepProgress
    let stepsList: UnitStepType[] = [];
    if (unit.steps && unit.steps.length > 0) {
      stepsList = unit.steps.map((s) => s.type);
    } else {
      stepsList = ["warmup"];
      if (unit.wordIds?.length > 0) {
        stepsList.push("vocabulary", "speaking");
      }
      if (unit.grammarTopic && unit.grammarExplanation) {
        stepsList.push("grammar");
      }
      if (unit.videoUrl) {
        stepsList.push("video");
      }
      if (unit.readingText) {
        stepsList.push("reading");
      }
      stepsList.push("test");
    }

    const completedSteps = unit.completedSteps || [];

    // Якщо крок вже пройдений — дозволяємо доступ (для повторення)
    if (completedSteps.includes(stepType)) return true;

    // Знаходимо перший ще не пройдений крок
    const firstUncompleted = stepsList.find(
      (type) => !completedSteps.includes(type),
    );

    // Дозволяємо доступ, тільки якщо запитуваний крок є наступним у черзі
    return firstUncompleted === stepType;
  }, [unit, stepType]);

  const stepProgress = useMemo(() => {
    if (!unit) return { current: 0, total: 0 };

    let totalSteps = unit.steps?.length || 0;

    if (totalSteps === 0) {
      const dynamicSteps = ["warmup"];
      if (unit.wordIds?.length > 0) {
        dynamicSteps.push("vocabulary");
        dynamicSteps.push("speaking");
      }
      if (unit.grammarTopic && unit.grammarExplanation)
        dynamicSteps.push("grammar");
      if (unit.videoUrl) dynamicSteps.push("video");
      if (unit.readingText) dynamicSteps.push("reading");
      dynamicSteps.push("test");

      totalSteps = dynamicSteps.length;
    }

    const completedUnique = new Set(unit.completedSteps || []).size;
    return { current: completedUnique, total: totalSteps };
  }, [unit]);

  if (!unit || !stepType)
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--text-muted)]">Урок не знайдено</p>
      </Screen>
    );

  // Редирект, якщо користувач намагається зайти на заблокований крок через URL
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
      } else {
        // При завершенні проміжного кроку повертаємось на екран вибору кроків
        navigate(`/path/${unit.id}`);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  if (isUnitFinishedModalOpen) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-20 h-20 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-full flex items-center justify-center animate-bounce">
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
