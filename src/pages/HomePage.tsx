import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, BrainCircuit, Sparkles, MoreVertical } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
import { useUserStore } from "../store/userStore";
import { useProgressStore } from "../store/progressStore";
import { useRepetitionStore } from "../store/repetitionStore";

export const HomePage = () => {
  const { level, streak, wordsLearnedCount } = useUserStore();
  const {
    units,
    currentUnitId,
    loadUnits,
    isLoading,
    progressPercent,
    lastFetchedLevel, // Залишили тільки потрібні змінні
  } = useProgressStore();
  const { dailyQueue, loadDailyWords, status } = useRepetitionStore();

  useEffect(() => {
    if (status === "idle") {
      loadDailyWords();
    }
  }, [status, loadDailyWords]);

  useEffect(() => {
    if (units.length === 0 || lastFetchedLevel !== level) {
      loadUnits(level || "A1");
    }
  }, [units.length, loadUnits, level, lastFetchedLevel]);

  const activeUnit = units.find((u) => u.id === currentUnitId) ?? units[0];
  const reviewWordsCount = dailyQueue.length;

  const completedUnitsCount = units.filter(
    (u) => u.status === "completed",
  ).length;
  const totalUnitsCount = units.length;

  return (
    <Screen className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <CookieMascot state="happy" size={50} />
          <div>
            <div className="flex items-center gap-1.5">
              <Badge className="px-2 py-0.5 font-bold text-[10px] tracking-wide">
                {level}
              </Badge>
              <span className="text-[11px] text-[var(--text-muted)] font-medium">
                Початковий курс
              </span>
            </div>
            <h1 className="text-lg font-black text-[var(--text-main)] leading-tight mt-0.5">
              Привіт, друже! 🍪
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StreakBadge streak={streak} />
          <Link
            to="/settings"
            className="p-2 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] transition-colors active:opacity-70 border border-[var(--border-color)]"
          >
            <MoreVertical className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <Card className="space-y-2.5">
        <div className="flex justify-between items-center text-sm font-semibold">
          <span className="text-[var(--text-main)]">Прогрес рівня {level}</span>
          <span className="text-[var(--accent-cta)] font-bold">
            {progressPercent}%
          </span>
        </div>
        <ProgressBar progress={progressPercent} />
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>
            Пройдено тем: {completedUnitsCount} з {totalUnitsCount}
          </span>
          <span>{totalUnitsCount - completedUnitsCount} залишилось</span>
        </div>
      </Card>

      <Card className="space-y-4 border-[var(--accent-cta)]/20">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--accent-cta)]">
              Поточна тема
            </span>
            <h2 className="text-xl font-bold mt-1 text-[var(--text-main)]">
              {isLoading
                ? "Завантаження..."
                : (activeUnit?.title ?? "Немає активних уроків")}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Граматика:{" "}
              {activeUnit?.grammarTopic || activeUnit?.grammar?.title || "—"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {activeUnit ? (
          <Link
            to={`/path/${activeUnit.id}`}
            state={{ from: "/" }}
            className="block"
          >
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

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-cta)]/15 text-[var(--accent-cta)] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {wordsLearnedCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              слів вивчено
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-start gap-2 p-3.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-success)]/15 text-[var(--accent-success)] flex items-center justify-center">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {reviewWordsCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              на сьогодні
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
};
