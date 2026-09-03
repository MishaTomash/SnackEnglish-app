import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, BrainCircuit, Sparkles } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
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
      {/* Верхній блок: Привітання з маскотом та StreakBadge */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <CookieMascot state="happy" size={50} />
          <div>
            <div className="flex items-center gap-1.5">
              <Badge className="px-2 py-0.5 font-bold text-[10px] tracking-wide">
                {level} → A2
              </Badge>
              <span className="text-[11px] text-cookieText-muted font-medium">
                Початковий курс
              </span>
            </div>
            <h1 className="text-lg font-black text-cookieText-primary leading-tight mt-0.5">
              Привіт, друже! 🍪
            </h1>
          </div>
        </div>

        <StreakBadge streak={streak} />
      </div>

      {/* Прогрес по рівню */}
      <Card className="space-y-2.5">
        <div className="flex justify-between items-center text-sm font-semibold">
          <span className="text-cookieText-primary">Прогрес рівня {level}</span>
          <span className="text-primary font-bold">{progressPercent}%</span>
        </div>
        <ProgressBar progress={progressPercent} />
        <div className="flex justify-between text-xs text-cookieText-muted">
          <span>
            Пройдено тем: {completedCount} з {totalCount}
          </span>
          <span>{totalCount - completedCount} залишилось</span>
        </div>
      </Card>

      {/* Картка "Поточна тема" */}
      <Card className="space-y-4 border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-primary">
              Поточна тема
            </span>
            <h2 className="text-xl font-bold mt-1 text-cookieText-primary">
              {isLoading
                ? "Завантаження..."
                : (activeUnit?.title ?? "Немає активних уроків")}
            </h2>
            <p className="text-xs text-cookieText-muted mt-0.5">
              Граматика: {activeUnit?.grammarTopic ?? "—"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {activeUnit ? (
          <Link to={`/path/${activeUnit.id}`} className="block">
            <Button variant="primary" className="w-full">
              Продовжити урок
            </Button>
          </Link>
        ) : (
          <Button variant="primary" disabled className="w-full">
            Урок недоступний
          </Button>
        )}
      </Card>

      {/* Статистичний грід */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-cookieText-primary leading-none">
              {wordsLearnedCount}
            </div>
            <div className="text-xs text-cookieText-muted mt-1 font-medium">
              слів вивчено
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-cookieText-primary leading-none">
              {reviewWordsCount}
            </div>
            <div className="text-xs text-cookieText-muted mt-1 font-medium">
              на повторення
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
};
