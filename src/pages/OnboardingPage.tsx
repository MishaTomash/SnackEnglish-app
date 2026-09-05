import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
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

type OnboardingStep = "choice" | "manual" | "test" | "saving";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, isLoading, error } = useUserStore();
  const loadUnits = useProgressStore((state) => state.loadUnits);

  const [step, setStep] = useState<OnboardingStep>("choice");
  const [determinedLevel, setDeterminedLevel] = useState<EnglishLevel | null>(
    null,
  );

  // Test State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const totalQuestions = testQuestions.length;
  const currentQuestion = testQuestions[currentIndex];

  const handleFinish = async (level: EnglishLevel) => {
    setDeterminedLevel(level);
    setStep("saving");

    const success = await completeOnboarding(level);
    if (success) {
      await loadUnits(level);
      navigate("/");
    }
    // Якщо success === false, залишаємось на кроці 'saving' де покажеться error
  };

  const handleSelectTestOption = (optionIndex: number) => {
    const updatedAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(updatedAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const correctCount = updatedAnswers.reduce((acc, answerIdx, idx) => {
        return answerIdx === testQuestions[idx].correctIndex ? acc + 1 : acc;
      }, 0);
      const level: EnglishLevel = correctCount >= 6 ? "A2" : "A1";
      handleFinish(level);
    }
  };

  // --- RENDERS PER STEP ---

  if (step === "saving") {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <CookieMascot state={error ? "thinking" : "celebrating"} size={96} />

        {error ? (
          <div className="space-y-4 w-full">
            <Badge className="bg-red-500/20 text-red-400">Помилка</Badge>
            <p className="text-sm text-cookieText-primary">{error}</p>
            <Button
              onClick={() => handleFinish(determinedLevel!)}
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Спробувати ще раз
            </Button>
            <Button
              onClick={() => setStep("choice")}
              variant="secondary"
              className="w-full"
            >
              Почати спочатку
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-cookieText-primary animate-pulse">
              Готуємо твої снеки... 🍪
            </h1>
            <p className="text-sm text-cookieText-muted">
              Зберігаємо рівень {determinedLevel}
            </p>
          </div>
        )}
      </Screen>
    );
  }

  if (step === "choice") {
    return (
      <Screen className="justify-center items-center p-6 space-y-8">
        <div className="text-center space-y-4">
          <CookieMascot state="happy" size={80} className="mx-auto" />
          <h1 className="text-2xl font-black text-cookieText-primary">
            Привіт! 👋
          </h1>
          <p className="text-sm text-cookieText-muted leading-relaxed">
            Щоб підібрати для тебе найсмачніші уроки, нам потрібно знати твій
            рівень англійської.
          </p>
        </div>

        <div className="w-full space-y-3">
          <Button
            onClick={() => setStep("test")}
            variant="primary"
            size="lg"
            className="w-full font-bold relative overflow-hidden"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Пройти короткий тест
          </Button>

          <Button
            onClick={() => setStep("manual")}
            variant="secondary"
            size="lg"
            className="w-full font-bold"
          >
            Я знаю свій рівень (Вручну)
          </Button>
        </div>
      </Screen>
    );
  }

  if (step === "manual") {
    const levels: { id: EnglishLevel; desc: string }[] = [
      { id: "A1", desc: "Початківець (Beginner)" },
      { id: "A2", desc: "Базовий (Elementary)" },
      { id: "B1", desc: "Середній (Intermediate)" },
      { id: "B2", desc: "Вище середнього (Upper-Int.)" },
      { id: "C1", desc: "Просунутий (Advanced)" },
    ];

    return (
      <Screen className="justify-start p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-cookieText-primary">
            Обери свій рівень
          </h1>
          <p className="text-xs text-cookieText-muted">
            Не хвилюйся, ти зможеш змінити його пізніше у налаштуваннях.
          </p>
        </div>

        <div className="space-y-3">
          {levels.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => handleFinish(lvl.id)}
              disabled={isLoading}
              className="w-full p-4 rounded-2xl text-left border border-card-border bg-card text-cookieText-primary hover:bg-card-hover active:bg-primary transition-all flex items-center justify-between shadow-cookie-sm disabled:opacity-50"
            >
              <div>
                <span className="font-bold text-lg mr-3">{lvl.id}</span>
                <span className="text-sm opacity-80">{lvl.desc}</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-40" />
            </button>
          ))}
        </div>

        <Button
          onClick={() => setStep("choice")}
          variant="ghost"
          className="w-full"
        >
          Назад
        </Button>
      </Screen>
    );
  }

  // Стейт "test"
  const progressPercent = Math.round(
    ((currentIndex + 1) / totalQuestions) * 100,
  );

  return (
    <Screen className="justify-between space-y-4">
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

      <div className="my-auto space-y-4">
        <Card className="p-6 text-center space-y-2.5 border-primary/20">
          <Badge className="text-[10px] uppercase font-bold tracking-wider">
            {currentQuestion.type}
          </Badge>
          <h2 className="text-xl font-bold leading-snug text-cookieText-primary">
            {currentQuestion.question}
          </h2>
        </Card>

        <div className="space-y-2.5">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={option}
              onClick={() => handleSelectTestOption(idx)}
              className="w-full p-4 rounded-2xl font-semibold text-left border border-card-border bg-card text-cookieText-primary hover:bg-card-hover active:bg-primary active:text-primary-foreground transition-all flex items-center justify-between shadow-cookie-sm"
            >
              <span>{option}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          ))}
        </div>
      </div>

      <div className="text-center flex flex-col gap-3">
        <div className="text-[11px] text-cookieText-muted font-medium">
          Обери одну відповідь, щоб перейти далі
        </div>
        <button
          onClick={() => setStep("choice")}
          className="text-xs text-primary underline underline-offset-2 opacity-80"
        >
          Зупинити тест
        </button>
      </div>
    </Screen>
  );
};
