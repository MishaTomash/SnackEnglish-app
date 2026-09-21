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

type QuestionLevel = "A1" | "A2" | "B1" | "B2" | "C1";
type QuestionType = "grammar" | "vocabulary" | "reading";

interface TestQuestion {
  id: number;
  level: QuestionLevel;
  weight: number;
  type: QuestionType;
  passage: string | null;
  question: string;
  options: string[];
  correctIndex: number;
}

const QUESTIONS = testQuestions as TestQuestion[];
const LEVEL_ORDER: QuestionLevel[] = ["A1", "A2", "B1", "B2", "C1"];
const PASS_THRESHOLD = 0.7;

const computeLevel = (answers: number[]): EnglishLevel => {
  const stats = new Map<QuestionLevel, { earned: number; total: number }>();

  QUESTIONS.forEach((q, idx) => {
    const bucket = stats.get(q.level) ?? { earned: 0, total: 0 };
    bucket.total += q.weight;
    if (answers[idx] === q.correctIndex) bucket.earned += q.weight;
    stats.set(q.level, bucket);
  });

  let result: EnglishLevel = "A1";
  for (const lvl of LEVEL_ORDER) {
    const s = stats.get(lvl);
    if (!s) continue;
    if (s.earned / s.total >= PASS_THRESHOLD) {
      result = lvl;
    } else {
      break;
    }
  }
  return result;
};

interface Props {
  onFinish: (level: EnglishLevel) => void;
  onCancel: () => void;
}

export const LevelPlacementTest = ({ onFinish, onCancel }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const totalQuestions = QUESTIONS.length;
  const currentQuestion = QUESTIONS[currentIndex];

  const handleSelectTestOption = (optionIndex: number) => {
    const updatedAnswers = [...selectedAnswers, optionIndex];
    setSelectedAnswers(updatedAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onFinish(computeLevel(updatedAnswers));
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
        {currentQuestion.passage && (
          <Card className="p-4 text-sm leading-relaxed text-cookieText-muted italic">
            {currentQuestion.passage}
          </Card>
        )}

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
