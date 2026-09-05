// LevelPlacementTest.tsx
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { Badge } from "../../shared/ui/Badge";
import { ProgressBar } from "../../shared/ui/ProgressBar";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import type { EnglishLevel } from "../../entities/word/types";
import testQuestions from "../../mocks/placement-test.json";

interface Props {
  onFinish: (level: EnglishLevel) => void;
  onCancel: () => void;
}

export const LevelPlacementTest = ({ onFinish, onCancel }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const totalQuestions = testQuestions.length;
  const currentQuestion = testQuestions[currentIndex];

  const handleSelectTestOption = (optionIndex: number) => {
    const updatedAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(updatedAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      const correctCount = updatedAnswers.reduce((acc, answerIdx, idx) => {
        return answerIdx === testQuestions[idx].correctIndex ? acc + 1 : acc;
      }, 0);
      // Логіка визначення рівня (можна буде розширити для B1/B2, якщо тест стане довшим)
      const level: EnglishLevel = correctCount >= 6 ? "A2" : "A1";
      onFinish(level);
    }
  };

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
          onClick={onCancel}
          className="text-xs text-primary underline underline-offset-2 opacity-80"
        >
          Зупинити тест
        </button>
      </div>
    </Screen>
  );
};
