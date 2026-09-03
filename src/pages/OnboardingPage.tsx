import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useUserStore } from "../store/userStore";
import { useProgressStore } from "../store/progressStore";
import type { EnglishLevel } from "../entities/word/types";
import testQuestions from "../mocks/placement-test.json";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const setLevel = useUserStore((state) => state.setLevel);
  const loadUnits = useProgressStore((state) => state.loadUnits);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const totalQuestions = testQuestions.length;
  const currentQuestion = testQuestions[currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    const updatedAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(updatedAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const correctCount = selectedAnswers.reduce((acc, answerIdx, idx) => {
    return answerIdx === testQuestions[idx].correctIndex ? acc + 1 : acc;
  }, 0);

  const determinedLevel: EnglishLevel = correctCount >= 6 ? "A2" : "A1";

  const handleStartLearning = async () => {
    setLevel(determinedLevel);
    await loadUnits(determinedLevel);
    navigate("/");
  };

  if (isFinished) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        {/* Святковий маскот замість стандартного кубка */}
        <div className="flex justify-center">
          <CookieMascot state="celebrating" size={96} />
        </div>

        <div className="space-y-2">
          <Badge className="px-3 py-1 text-xs uppercase font-bold tracking-wider">
            Результат тесту
          </Badge>
          <h1 className="text-3xl font-black text-cookieText-primary">
            Твій рівень: {determinedLevel}
          </h1>
          <p className="text-xs text-cookieText-muted font-semibold">
            Правильних відповідей: {correctCount} з {totalQuestions}
          </p>
        </div>

        <Card className="p-4 text-left text-sm leading-relaxed space-y-2 bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/40">
          <div className="flex items-center gap-2 font-bold text-cookieText-primary">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>Що це означає?</span>
          </div>
          <p className="text-xs text-cookieText-muted leading-relaxed">
            {determinedLevel === "A2"
              ? "У тебе міцна базова основа! Ми підготували уроки для розширення словникового запасу та впевненого спілкування."
              : "Чудовий старт! Почнемо з фундаменту та ключових слів, щоб швидко вивести твою англійську на новий рівень."}
          </p>
        </Card>

        <Button
          onClick={handleStartLearning}
          variant="primary"
          size="lg"
          className="w-full py-4 font-bold"
        >
          Почати навчання 🍪
        </Button>
      </Screen>
    );
  }

  const progressPercent = Math.round(
    ((currentIndex + 1) / totalQuestions) * 100,
  );

  return (
    <Screen className="justify-between space-y-4">
      {/* Прогрес-бар з думаючим маскотом */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CookieMascot state="thinking" size={28} />
            <span className="text-xs font-bold text-cookieText-primary">
              Вхідний тест
            </span>
          </div>
          <span className="text-xs font-semibold text-cookieText-muted">
            {currentIndex + 1} / {totalQuestions}
          </span>
        </div>
        <ProgressBar progress={progressPercent} />
      </div>

      {/* Питання */}
      <div className="my-auto space-y-4">
        <Card className="p-6 text-center space-y-2.5 border-primary/20">
          <Badge className="text-[10px] uppercase font-bold tracking-wider">
            {currentQuestion.type}
          </Badge>
          <h2 className="text-xl font-bold leading-snug text-cookieText-primary">
            {currentQuestion.question}
          </h2>
        </Card>

        {/* Варіанти відповідей */}
        <div className="space-y-2.5">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={option}
              onClick={() => handleSelectOption(idx)}
              className="w-full p-4 rounded-2xl font-semibold text-left border border-card-border bg-card text-cookieText-primary hover:bg-card-hover active:bg-primary active:text-primary-foreground transition-all flex items-center justify-between shadow-cookie-sm"
            >
              <span>{option}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-[11px] text-cookieText-muted font-medium">
        Обери одну відповідь, щоб перейти далі
      </div>
    </Screen>
  );
};
