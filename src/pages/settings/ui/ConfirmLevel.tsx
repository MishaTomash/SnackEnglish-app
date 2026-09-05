import { Sparkles } from "lucide-react";
import { Screen } from "../../../shared/ui/Screen";
import { Button } from "../../../shared/ui/Button";
import type { EnglishLevel } from "../../../entities/word/types";

interface Props {
  pendingLevel: EnglishLevel | null;
  onConfirm: (level: EnglishLevel) => void;
  onTest: () => void;
  onCancel: () => void;
}

export const ConfirmLevel = ({
  pendingLevel,
  onConfirm,
  onTest,
  onCancel,
}: Props) => {
  const handleManualConfirm = () => {
    const message =
      "Зміна рівня оновить список уроків. Твій попередній прогрес збережеться, але на карті з'являться нові теми. Продовжити?";
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm(message, (confirmed: boolean) => {
        if (confirmed && pendingLevel) onConfirm(pendingLevel);
      });
    } else {
      if (window.confirm(message) && pendingLevel) onConfirm(pendingLevel);
    }
  };

  return (
    <Screen className="justify-center items-center p-6 space-y-8 bg-[var(--bg-app)]">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-black text-[var(--text-main)]">
          Підтвердити рівень
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Ми рекомендуємо пройти короткий тест, щоб точно підібрати матеріали.
        </p>
      </div>
      <div className="w-full space-y-3">
        <Button
          onClick={onTest}
          variant="primary"
          size="lg"
          className="w-full font-bold relative overflow-hidden"
        >
          <Sparkles className="w-4 h-4 mr-2" /> Пройти тест (Рекомендовано)
        </Button>
        <Button
          onClick={handleManualConfirm}
          variant="secondary"
          size="lg"
          className="w-full font-bold"
        >
          Встановити напряму
        </Button>
        <Button onClick={onCancel} variant="ghost" className="w-full mt-2">
          Скасувати
        </Button>
      </div>
    </Screen>
  );
};
