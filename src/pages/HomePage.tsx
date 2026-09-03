import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, BookOpen, BrainCircuit, Sparkles } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { useUserStore } from "../store/userStore";
import { useProgressStore } from "../store/progressStore";

export const HomePage = () => {
  const { level, streak, wordsLearnedCount } = useUserStore();
  const { units, currentUnitId, loadUnits, isLoading } = useProgressStore();

  useEffect(() => {
    if (units.length === 0) {
      loadUnits("A1");
    }
  }, [units.length, loadUnits]);

  const completedCount = units.filter((u) => u.status === "completed").length;
  const totalCount = units.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeUnit =
    units.find((u) => u.id === currentUnitId) ??
    units.find((u) => u.status === "available") ??
    units[0];

  const reviewWordsCount = 7; // Mock-число для слів на повторення сьогодні

  return (
    <Screen className="space-y-4">
      {/* Верхній рядок: Рівень та StreakBadge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="px-3 py-1 font-semibold text-xs tracking-wide">
            {level} → A2
          </Badge>
          <span className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] font-medium">
            Початковий курс
          </span>
        </div>

        {/* StreakBadge */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-bold text-xs">
          <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
          <span>
            {streak} {streak === 1 ? "день" : streak < 5 ? "дні" : "днів"}
          </span>
        </div>
      </div>

      {/* Прогрес по рівню */}
      <Card className="space-y-2.5">
        <div className="flex justify-between items-center text-sm font-semibold">
          <span>Прогрес рівня {level}</span>
          <span className="text-[var(--tg-theme-button-color,#3390ec)]">
            {progressPercent}%
          </span>
        </div>
        <ProgressBar progress={progressPercent} />
        <div className="flex justify-between text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
          <span>
            Пройдено тем: {completedCount} з {totalCount}
          </span>
          <span>{totalCount - completedCount} залишилось</span>
        </div>
      </Card>

      {/* Картка "Поточна тема" */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--tg-theme-button-color,#3390ec)]">
              Поточна тема
            </span>
            <h2 className="text-xl font-bold mt-1">
              {isLoading
                ? "Завантаження..."
                : (activeUnit?.title ?? "Немає активних уроків")}
            </h2>
            <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] mt-0.5">
              Граматика: {activeUnit?.grammarTopic ?? "—"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--tg-theme-button-color,#3390ec)]/10 text-[var(--tg-theme-button-color,#3390ec)] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {activeUnit ? (
          <Link to={`/path/${activeUnit.id}`} className="block">
            <Button variant="primary">Продовжити урок</Button>
          </Link>
        ) : (
          <Button variant="primary" disabled>
            Урок недоступний
          </Button>
        )}
      </Card>

      {/* Статистичний грід */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">
              {wordsLearnedCount}
            </div>
            <div className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] mt-1">
              слів вивчено
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">
              {reviewWordsCount}
            </div>
            <div className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] mt-1">
              на повторення
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
};
