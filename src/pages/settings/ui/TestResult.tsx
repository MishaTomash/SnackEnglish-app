import { Sparkles } from "lucide-react";
import { Screen } from "../../../shared/ui/Screen";
import { Button } from "../../../shared/ui/Button";
import type { EnglishLevel } from "../../../entities/word/types";
import { LEVELS } from "../constants";

interface Props {
  pendingLevel: EnglishLevel | null;
  onConfirm: (level: EnglishLevel) => void;
  onCancel: () => void;
}

export const TestResult = ({ pendingLevel, onConfirm, onCancel }: Props) => {
  const levelName = LEVELS.find((l) => l.id === pendingLevel)?.desc;

  return (
    <Screen className="justify-center items-center p-6 space-y-8 bg-[var(--bg-app)]">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-[var(--accent-success)]/10 text-[var(--accent-success)] rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-[var(--text-main)]">
          Тест завершено!
        </h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          За результатами твоїх відповідей ми визначили твій рівень:
        </p>
        <div className="py-2">
          <div className="text-4xl font-black text-[var(--accent-cta)]">
            {pendingLevel}
          </div>
          <div className="text-sm font-medium text-[var(--text-muted)] mt-1">
            {levelName}
          </div>
        </div>
      </div>
      <div className="w-full space-y-3">
        <Button
          onClick={() => pendingLevel && onConfirm(pendingLevel)}
          variant="primary"
          size="lg"
          className="w-full font-bold"
        >
          Зберегти і на Головну
        </Button>
        <Button onClick={onCancel} variant="ghost" className="w-full">
          Скасувати
        </Button>
      </div>
    </Screen>
  );
};
