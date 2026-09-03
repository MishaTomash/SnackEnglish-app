import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Award, ChevronRight } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
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

  // Розрахунок результату тесту
  // TODO: замінити на адаптивний алгоритм (складність питання залежить від попередньої відповіді) при переході на бекенд-версію.
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
        <div className="w-20 h-20 rounded-3xl bg-[var(--tg-theme-button-color,#3390ec)]/10 text-[var(--tg-theme-button-color,#3390ec)] flex items-center justify-center mx-auto shadow-sm">
          <Award className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <Badge className="px-3 py-1 text-xs uppercase font-bold tracking-wider">
            Результат тесту
          </Badge>
          <h1 className="text-3xl font-black">
            Твій рівень: {determinedLevel}
          </h1>
          <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] font-semibold">
            Правильних відповідей: {correctCount} з {totalQuestions}
          </p>
        </div>

        <Card className="p-4 text-left text-sm leading-relaxed space-y-2 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]/50 border-none">
          <div className="flex items-center gap-2 font-bold text-[var(--tg-theme-text-color,#000000)]">
            <Sparkles className="w-4 h-4 text-[var(--tg-theme-button-color,#3390ec)]" />
            <span>Що це означає?</span>
          </div>
          <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
            {determinedLevel === "A2"
              ? "У вас міцна базова основа! Ми підготували уроки для розширення словникового запасу та впевненого спілкування."
              : "Чудовий старт! Ми почнемо з фундаменту та ключових слів, щоб швидко вивести вашу англійську на новий рівень."}
          </p>
        </Card>

        <Button
          onClick={handleStartLearning}
          variant="primary"
          className="w-full py-3.5 font-bold"
        >
          Почати навчання
        </Button>
      </Screen>
    );
  }

  const progressPercent = Math.round(
    ((currentIndex + 1) / totalQuestions) * 100,
  );

  return (
    <Screen className="justify-between space-y-4">
      {/* Прогрес-бар */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-[var(--tg-theme-hint-color,#8e8e93)]">
          <span>Вхідний тест</span>
          <span>
            {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
        <ProgressBar progress={progressPercent} />
      </div>

      {/* Питання */}
      <div className="my-auto space-y-4">
        <Card className="p-6 text-center space-y-2">
          <Badge className="text-[10px] uppercase font-bold tracking-wider">
            {currentQuestion.type}
          </Badge>
          <h2 className="text-xl font-bold leading-snug">
            {currentQuestion.question}
          </h2>
        </Card>

        {/* Варіанти */}
        <div className="space-y-2.5">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={option}
              onClick={() => handleSelectOption(idx)}
              className="w-full p-4 rounded-2xl font-semibold text-left border border-[var(--tg-theme-hint-color,#8e8e93)]/20 bg-[var(--tg-theme-bg-color,#ffffff)] text-[var(--tg-theme-text-color,#000000)] active:bg-[var(--tg-theme-button-color,#3390ec)] active:text-white transition-all flex items-center justify-between shadow-sm"
            >
              <span>{option}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-[10px] text-[var(--tg-theme-hint-color,#8e8e93)]">
        Оберіть одну відповідь, щоб перейти далі
      </div>
    </Screen>
  );
};
