import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, BarChart2 } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { useUserStore } from "../../store/userStore";
import { useProgressStore } from "../../store/progressStore";
import type { EnglishLevel } from "../../entities/word/types";

const LEVELS: { id: EnglishLevel; desc: string }[] = [
  { id: "A1", desc: "Початківець (Beginner)" },
  { id: "A2", desc: "Базовий (Elementary)" },
  { id: "B1", desc: "Середній (Intermediate)" },
  { id: "B2", desc: "Вище середнього (Upper-Int.)" },
  { id: "C1", desc: "Просунутий (Advanced)" },
  { id: "C2", desc: "Просунутий+ (Proficiency)" },
];

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { level, streak, updateLevel, isLoading } = useUserStore();
  const { units, loadUnits } = useProgressStore();

  const completedCount = units.filter((u) => u.status === "completed").length;

  const handleLevelChange = async (newLevel: EnglishLevel) => {
    if (newLevel === level) return;

    const confirmed = window.confirm(
      "Зміна рівня оновить список уроків. Твій попередній прогрес збережеться в базі, але на карті з'являться нові теми. Продовжити?",
    );

    if (!confirmed) return;

    const success = await updateLevel(newLevel);
    if (success) {
      await loadUnits(newLevel); // Перезавантажуємо юніти для нового рівня
      navigate("/");
    }
  };

  return (
    <Screen className="justify-start p-4 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] active:opacity-70"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[var(--tg-theme-text-color)]">
          Налаштування
        </h1>
      </div>

      <Card className="p-4 space-y-4 border-[var(--tg-theme-hint-color)]/20">
        <div className="flex items-center gap-2 text-[var(--tg-theme-hint-color)] mb-2">
          <BarChart2 className="w-5 h-5" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Статистика
          </h2>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--tg-theme-text-color)] font-medium">
            Днів поспіль (Streak)
          </span>
          <span className="font-bold text-amber-500">{streak} 🔥</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--tg-theme-text-color)] font-medium">
            Пройдено тем
          </span>
          <span className="font-bold text-[var(--tg-theme-button-color)]">
            {completedCount}
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--tg-theme-hint-color)] ml-1">
          Змінити рівень
        </h2>
        {LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            onClick={() => handleLevelChange(lvl.id)}
            disabled={isLoading}
            className={`w-full p-4 rounded-2xl text-left border transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${
              level === lvl.id
                ? "bg-[var(--tg-theme-button-color)] border-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]"
                : "bg-[var(--tg-theme-secondary-bg-color)] border-[var(--tg-theme-hint-color)]/20 text-[var(--tg-theme-text-color)] active:opacity-70"
            }`}
          >
            <div>
              <span className="font-bold text-lg mr-3">{lvl.id}</span>
              <span className="text-sm opacity-90">{lvl.desc}</span>
            </div>
            {level === lvl.id ? (
              <span className="text-xs font-bold uppercase tracking-wide">
                Поточний
              </span>
            ) : (
              <ChevronRight className="w-5 h-5 opacity-40" />
            )}
          </button>
        ))}
      </div>
    </Screen>
  );
};
