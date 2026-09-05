// SettingsPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  BarChart2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button"; // <-- Переконайся, що Button імпортовано
import { useUserStore } from "../../store/userStore";
import { useProgressStore } from "../../store/progressStore";
import type { EnglishLevel } from "../../entities/word/types";
import { LevelPlacementTest } from "../../shared/ui/LevelPlacementTest"; // <-- Вкажи правильний шлях!

const LEVELS: { id: EnglishLevel; desc: string }[] = [
  { id: "A1", desc: "Початківець (Beginner)" },
  { id: "A2", desc: "Базовий (Elementary)" },
  { id: "B1", desc: "Середній (Intermediate)" },
  { id: "B2", desc: "Вище середнього (Upper-Int.)" },
  { id: "C1", desc: "Просунутий (Advanced)" },
  { id: "C2", desc: "Просунутий+ (Proficiency)" },
];

type SettingsStep = "list" | "choice" | "test" | "result";

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { level, streak, updateLevel, isLoading } = useUserStore();
  const { units, loadUnits } = useProgressStore();

  const [step, setStep] = useState<SettingsStep>("list");
  const [pendingLevel, setPendingLevel] = useState<EnglishLevel | null>(null);
  const [localLoading, setLocalLoading] = useState<EnglishLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedCount = units.filter((u) => u.status === "completed").length;

  const handleLevelClick = (clickedLevel: EnglishLevel) => {
    if (clickedLevel === level) return;
    setPendingLevel(clickedLevel);
    setStep("choice");
  };

  const processChange = async (newLevel: EnglishLevel) => {
    setStep("list"); // Повертаємось на головний екран налаштувань для показу лоадера
    setError(null);
    setLocalLoading(newLevel);

    try {
      const success = await updateLevel(newLevel);
      if (success) {
        await loadUnits(newLevel);
        navigate("/");
      } else {
        setError("Не вдалося оновити рівень. Спробуй ще раз.");
      }
    } catch (err) {
      setError("Помилка з'єднання. Перевір інтернет і спробуй ще раз.");
    } finally {
      setLocalLoading(null);
    }
  };

  const handleManualConfirm = () => {
    const message =
      "Зміна рівня оновить список уроків. Твій попередній прогрес збережеться, але на карті з'являться нові теми. Продовжити?";

    const tg = (window as any).Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm(message, (confirmed: boolean) => {
        if (confirmed && pendingLevel) void processChange(pendingLevel);
      });
    } else {
      if (window.confirm(message) && pendingLevel)
        void processChange(pendingLevel);
    }
  };

  // --- RENDERS ---

  if (step === "test") {
    return (
      <LevelPlacementTest
        onFinish={(testedLevel) => {
          setPendingLevel(testedLevel);
          setStep("result");
        }}
        onCancel={() => setStep("list")}
      />
    );
  }

  if (step === "result") {
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
            onClick={() => pendingLevel && void processChange(pendingLevel)}
            variant="primary"
            size="lg"
            className="w-full font-bold"
          >
            Зберегти і на Головну
          </Button>

          <Button
            onClick={() => setStep("list")}
            variant="ghost"
            className="w-full"
          >
            Скасувати
          </Button>
        </div>
      </Screen>
    );
  }

  if (step === "choice") {
    return (
      <Screen className="justify-center items-center p-6 space-y-8 bg-[var(--bg-app)]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-black text-[var(--text-main)]">
            Підтвердити рівень
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Ми рекомендуємо пройти короткий тест, щоб точно підібрати матеріали
            для тебе. Але ти можеш змінити рівень і без нього.
          </p>
        </div>

        <div className="w-full space-y-3">
          <Button
            onClick={() => setStep("test")}
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

          <Button
            onClick={() => setStep("list")}
            variant="ghost"
            className="w-full mt-2"
          >
            Скасувати
          </Button>
        </div>
      </Screen>
    );
  }

  // Головний екран налаштувань (step === "list")
  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)]">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] active:opacity-70"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[var(--text-main)]">
          Налаштування
        </h1>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <BarChart2 className="w-5 h-5" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Статистика
          </h2>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--text-main)] font-medium">
            Днів поспіль (Streak)
          </span>
          <span className="font-bold text-amber-500">{streak} 🔥</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--text-main)] font-medium">
            Пройдено тем
          </span>
          <span className="font-bold text-[var(--accent-cta)]">
            {completedCount}
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] ml-1">
          Змінити рівень
        </h2>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-[var(--accent-error)]/10 text-[var(--accent-error)] border border-[var(--accent-error)]/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {LEVELS.map((lvl) => {
          const isActive = level === lvl.id;
          const isCurrentLoading = localLoading === lvl.id;

          return (
            <button
              key={lvl.id}
              onClick={() => handleLevelClick(lvl.id)}
              disabled={isLoading || localLoading !== null}
              className={`w-full p-4 rounded-2xl text-left border transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${
                isActive
                  ? "bg-[var(--accent-cta)] border-[var(--accent-cta-active)] text-[var(--text-accent)]"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-card-elevated)] active:opacity-70"
              }`}
            >
              <div>
                <span className="font-bold text-lg mr-3">{lvl.id}</span>
                <span
                  className={`text-sm ${isActive ? "opacity-90" : "text-[var(--text-muted)]"}`}
                >
                  {lvl.desc}
                </span>
              </div>
              {isCurrentLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-[var(--accent-cta)]" />
              ) : isActive ? (
                <span className="text-xs font-bold uppercase tracking-wide">
                  Поточний
                </span>
              ) : (
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] opacity-60" />
              )}
            </button>
          );
        })}
      </div>
    </Screen>
  );
};
