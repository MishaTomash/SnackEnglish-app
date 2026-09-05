import { useState } from "react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import type { Unit } from "../../../entities/unit/types";

export const ReadingStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);

  return (
    <div className="space-y-4 my-auto">
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-base">Прочитайте текст:</h3>
        <p className="text-base leading-relaxed tracking-wide">
          {unit.readingText}
        </p>

        {showTranslation && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm leading-relaxed">
            {unit.readingTranslation}
          </div>
        )}
        <Button
          variant="secondary"
          onClick={() => setShowTranslation(!showTranslation)}
          className="py-2 text-xs w-full"
        >
          {showTranslation ? "Сховати переклад" : "Показати переклад"}
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <span className="text-xs font-semibold text-slate-400">
          Запитання на розуміння:
        </span>
        <p className="text-sm font-medium">Is Anna from Ukraine?</p>
        <div className="grid grid-cols-2 gap-2">
          {["Yes, she is", "No, she is not"].map((opt, i) => (
            <button
              key={opt}
              onClick={() => setAnswer(i)}
              className={`py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all ${
                answer === i
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>
      <Button
        onClick={onComplete}
        variant="primary"
        className="w-full"
        disabled={answer === null}
      >
        Завершити читання
      </Button>
    </div>
  );
};
