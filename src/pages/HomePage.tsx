import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BrainCircuit,
  Sparkles,
  MoreVertical,
  User as UserIcon,
  Trophy,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
import { useUserStore } from "../store/userStore";
import { useProgressStore } from "../store/progressStore";
import { useRepetitionStore } from "../store/repetitionStore";

const resolveAvatarUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:3000")
    .replace(/\/api$/, "")
    .replace(/\/$/, "");
  return `${apiBase}${url}?ngrok-skip-browser-warning=true`;
};

export const HomePage = () => {
  const {
    level,
    streak,
    totalScore,
    wordsLearnedCount,
    telegramFirstName,
    telegramPhotoUrl,
    customDisplayName,
    customAvatarUrl,
    nickname,
  } = useUserStore();

  const {
    units,
    currentUnitId,
    loadUnits,
    isLoading,
    progressPercent,
    lastFetchedLevel,
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

  const currentDisplayName =
    customDisplayName || telegramFirstName || "Користувач";
  const currentPhotoUrl = resolveAvatarUrl(customAvatarUrl) || telegramPhotoUrl;

  return (
    <Screen className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="relative shrink-0">
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover bg-[var(--bg-app)] border border-[var(--border-color)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-color)]">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-[var(--text-main)] leading-tight truncate max-w-[140px]">
                {currentDisplayName}
              </h1>
              {/* ВИПРАВЛЕНО: text-[var(--text-main)] замість text-[var(--accent-cta)] */}
              <Badge className="px-1.5 py-0 font-bold text-[10px] tracking-wide bg-[var(--accent-cta)]/10 text-[var(--text-main)] border border-[var(--accent-cta)]/20">
                {level}
              </Badge>
            </div>

            {nickname ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] font-bold text-[var(--accent-cta)]">
                  Топ:
                </span>
                <span className="text-[10px] font-medium text-[var(--text-muted)]">
                  @{nickname}
                </span>
              </div>
            ) : (
              <Link to="/settings" className="mt-0.5">
                <span className="text-[11px] font-semibold text-amber-500 underline underline-offset-2 active:opacity-70">
                  Додай нікнейм і потрап у Топ
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-cta)]/10 border border-[var(--accent-cta)]/20 text-[var(--accent-cta)] font-black text-sm shadow-sm">
            <Trophy className="w-4 h-4" />
            <span>{totalScore || 0}</span>
          </div>

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
        <Card className="flex flex-col items-start gap-2 p-3.5 h-full">
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

        <Link to="/practice" className="block h-full">
          <Card
            className={`flex flex-col items-start gap-2 p-3.5 h-full transition-all active:scale-[0.98] ${
              reviewWordsCount > 0
                ? "border-[var(--accent-success)] bg-[var(--accent-success)]/5 shadow-sm"
                : "border-[var(--border-color)]"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                reviewWordsCount > 0
                  ? "bg-[var(--accent-success)]/20 text-[var(--accent-success)]"
                  : "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"
              }`}
            >
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-main)] leading-none">
                {reviewWordsCount}
              </div>
              <div
                className={`text-xs mt-1 font-medium ${
                  reviewWordsCount > 0
                    ? "text-[var(--accent-success)] font-bold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {reviewWordsCount > 0 ? "до Практики ➔" : "на сьогодні"}
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </Screen>
  );
};
