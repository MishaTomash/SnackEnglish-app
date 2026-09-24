// OnboardingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useUserStore } from "../store/userStore";
import type { EnglishLevel } from "../entities/word/types";
import { LevelPlacementTest } from "../shared/ui/LevelPlacementTest";

type OnboardingStep = "choice" | "manual" | "test" | "saving";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, isLoading, error } = useUserStore();

  const [step, setStep] = useState<OnboardingStep>("choice");
  const [determinedLevel, setDeterminedLevel] = useState<EnglishLevel | null>(
    null,
  );

  const handleFinish = async (level: EnglishLevel) => {
    setDeterminedLevel(level);
    setStep("saving");

    const success = await completeOnboarding(level);
    if (success) {
      navigate("/");
    }
  };

  if (step === "saving") {
    // ... (залишаємо як було)
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
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Спробувати ще раз
            </Button>
            <Button
              onClick={() => setStep("choice")}
              variant="secondary"
              disabled={isLoading}
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
    // ... (залишаємо як було)
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
            <Sparkles className="w-4 h-4 mr-2" /> Пройти короткий тест
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
    // ... (залишаємо як було)
    const levels: { id: EnglishLevel; desc: string }[] = [
      { id: "A1", desc: "Початківець (Beginner)" },
      { id: "A2", desc: "Базовий (Elementary)" },
      { id: "B1", desc: "Середній (Intermediate)" },
      { id: "B2", desc: "Вище середнього (Upper-Int.)" },
      { id: "C1", desc: "Просунутий (Advanced)" },
      { id: "C2", desc: "Просунутий+ (Proficiency)" },
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

  if (step === "test") {
    return (
      <LevelPlacementTest
        onFinish={handleFinish}
        onCancel={() => setStep("choice")}
      />
    );
  }

  return null;
};