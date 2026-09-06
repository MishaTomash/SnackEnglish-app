import { useState, useMemo } from "react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import type { Unit } from "../../../entities/unit/types";
import { RotateCcw } from "lucide-react";

// Алгоритм Тасовання Фішера-Єтса
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Додаємо інтерфейс для правильної типізації питань
interface ReadingQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export const ReadingStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Використовуємо 'any' для безпечного доступу до нових полів, яких ще немає в старому інтерфейсі Unit
  const unitData = unit as any;

  // Читаємо дані або з нової структури (steps.reading), або зі старої (reading), щоб уникнути undefined
  const readingBlock = unitData.steps?.reading || unitData.reading || {};
  const questions: ReadingQuestion[] = readingBlock.questions || [];

  const title = readingBlock.title || "Прочитайте текст:";
  const text = readingBlock.text || unitData.readingText;
  const translation = readingBlock.translation || unitData.readingTranslation;

  const currentQuestion = questions[currentQIdx];

  // Перемішуємо варіанти тільки при зміні питання та жорстко вказуємо, що це масив рядків
  const shuffledOptions = useMemo(() => {
    if (!currentQuestion?.options) return [];
    return shuffleArray<string>(currentQuestion.options);
  }, [currentQuestion]);

  const handleSelect = (optText: string) => {
    setSelectedText(optText);
    setIsError(false);
  };

  const handleNext = () => {
    if (!currentQuestion || !selectedText) return;

    if (selectedText === currentQuestion.correctAnswer) {
      if (currentQIdx < questions.length - 1) {
        setCurrentQIdx((p) => p + 1);
        setSelectedText(null);
      } else {
        onComplete();
      }
    } else {
      setIsError(true);
    }
  };

  return (
    <div className="space-y-4 my-auto pb-4">
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-base">{title}</h3>
        <p className="text-base leading-relaxed tracking-wide">{text}</p>

        {showTranslation && translation && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm leading-relaxed">
            {translation}
          </div>
        )}
        {translation && (
          <Button
            variant="secondary"
            onClick={() => setShowTranslation(!showTranslation)}
            className="py-2 text-xs w-full"
          >
            {showTranslation ? "Сховати переклад" : "Показати переклад"}
          </Button>
        )}
      </Card>

      {currentQuestion ? (
        <Card className="p-4 space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-muted)]">
            <span>
              Запитання {currentQIdx + 1} з {questions.length}:
            </span>
          </div>
          <p className="text-sm font-bold text-[var(--text-main)]">
            {currentQuestion.question}
          </p>
          <div className="space-y-2">
            {shuffledOptions.map((opt) => (
              <button
                key={opt} // Тепер TypeScript точно знає, що opt - це рядок
                onClick={() => handleSelect(opt)}
                className={`w-full p-3 text-left text-sm font-semibold rounded-xl border-2 transition-all ${
                  selectedText === opt
                    ? isError
                      ? "bg-red-50 text-red-600 border-red-500"
                      : "bg-[var(--accent-cta)] text-white border-[var(--accent-cta)]"
                    : "bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--accent-cta)]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {isError && (
            <div className="flex items-center gap-2 text-sm text-red-500 font-bold justify-center pt-2">
              <RotateCcw className="w-4 h-4" /> Невірно, спробуйте ще раз!
            </div>
          )}

          <Button
            onClick={handleNext}
            variant="primary"
            className="w-full mt-2"
            disabled={!selectedText}
          >
            {currentQIdx < questions.length - 1 ? "Далі" : "Завершити читання"}
          </Button>
        </Card>
      ) : (
        <Button onClick={onComplete} variant="primary" className="w-full">
          Завершити читання
        </Button>
      )}
    </div>
  );
};
