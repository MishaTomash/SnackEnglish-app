import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Flame,
  Gamepad2,
  PartyPopper,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { ProgressBar } from "../../shared/ui/ProgressBar";
import { DailyCookie } from "../../shared/ui/DailyCookie";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import {
  computeStreak,
  DAILY_GOAL,
  todayKey,
  useLearningStore,
} from "../../store/learningStore";
import { useUserStore } from "../../store/userStore";
import type { Accent, Category } from "../../entities/learning/types";
import { AdminPanel } from "./AdminPanel";

const accentProgress: Record<Accent, "amber" | "emerald" | "sky" | "rose"> = {
  amber: "amber",
  emerald: "emerald",
  sky: "sky",
  rose: "rose",
};

const accentBadge: Record<Accent, string> = {
  amber: "bg-amber-500/15 text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  sky: "bg-sky-500/15 text-sky-400",
  rose: "bg-rose-500/15 text-rose-400",
};

const accentTint: Record<Accent, string> = {
  amber:
    "bg-[linear-gradient(180deg,rgba(245,158,11,0.10)_0%,transparent_60%)]",
  emerald:
    "bg-[linear-gradient(180deg,rgba(16,185,129,0.10)_0%,transparent_60%)]",
  sky: "bg-[linear-gradient(180deg,rgba(14,165,233,0.10)_0%,transparent_60%)]",
  rose: "bg-[linear-gradient(180deg,rgba(244,63,94,0.10)_0%,transparent_60%)]",
};

const accentGlow: Record<Accent, string> = {
  amber: "shadow-[0_0_28px_rgba(245,158,11,0.18)]",
  emerald: "shadow-[0_0_28px_rgba(16,185,129,0.18)]",
  sky: "shadow-[0_0_28px_rgba(14,165,233,0.18)]",
  rose: "shadow-[0_0_28px_rgba(244,63,94,0.18)]",
};

const DayCompletedOverlay = ({
  onDismiss,
  onGoGames,
  onGoFriends,
}: {
  onDismiss: () => void;
  onGoGames: () => void;
  onGoFriends: () => void;
}) => (
  <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
    <Card className="max-w-sm w-full text-center p-6 space-y-5 relative overflow-hidden">
      <div className="relative z-10 space-y-4">
        <CookieMascot state="celebrating" size={100} />
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-[var(--text-main)]">
            Ти впорався на сьогодні! 🎉
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Пройшов усі {DAILY_GOAL} категорії. Печиво з'їдено.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="secondary" className="w-full" onClick={onGoGames}>
            <Gamepad2 className="w-4 h-4 mr-1" /> Ігри
          </Button>
          <Button variant="secondary" className="w-full" onClick={onGoFriends}>
            <Users className="w-4 h-4 mr-1" /> Друзі
          </Button>
        </div>
        <Button variant="primary" className="w-full" onClick={onDismiss}>
          Закріпити ще раз
        </Button>
      </div>
    </Card>
  </div>
);

export const LearningHubPage = () => {
  const navigate = useNavigate();
  const { telegramId, level } = useUserStore();
  const {
    categories,
    isLoading,
    fetchCategories,
    xp,
    progress,
    celebratedDayKey,
    goalCompletedDates,
    markCelebrated,
    recordGoalReached,
  } = useLearningStore();

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const adminId = Number(import.meta.env.VITE_ADMIN_ID || "0");
  const isAdmin = telegramId === adminId;

  useEffect(() => {
    if (level) fetchCategories(level);
  }, [level, fetchCategories]);

  const startOfTodayMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const isCategoryDoneToday = (cat: Category): boolean => {
    if (!cat.units.length) return false;
    let lastCompletedAt = 0;
    for (const u of cat.units) {
      const p = progress[u.id];
      if (!p?.completed) return false;
      lastCompletedAt = Math.max(lastCompletedAt, p.completedAt);
    }
    return lastCompletedAt >= startOfTodayMs;
  };

  const todayCount = categories.filter(isCategoryDoneToday).length;
  const goalReached = todayCount >= DAILY_GOAL;
  const streak = useMemo(
    () => computeStreak(goalCompletedDates),
    [goalCompletedDates],
  );
  const today = todayKey();

  useEffect(() => {
    if (goalReached) recordGoalReached();
  }, [goalReached, recordGoalReached]);

  useEffect(() => {
    if (goalReached && celebratedDayKey !== today) setOverlayOpen(true);
  }, [goalReached, celebratedDayKey, today]);

  const dismissOverlay = () => {
    setOverlayOpen(false);
    markCelebrated();
  };

  const totalUnits = categories.reduce((a, c) => a + c.units.length, 0);
  const completedUnits = categories.reduce(
    (a, c) => a + c.units.filter((u) => progress[u.id]?.completed).length,
    0,
  );
  const nextCategoryId =
    categories.find((c) => !isCategoryDoneToday(c))?.id ?? null;

  return (
    <>
      {overlayOpen && (
        <DayCompletedOverlay
          onDismiss={dismissOverlay}
          onGoGames={() => {
            dismissOverlay();
            navigate("/games");
          }}
          onGoFriends={() => {
            dismissOverlay();
            navigate("/friends");
          }}
        />
      )}

      {showAdmin && isAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          onSaved={() => {
            setShowAdmin(false);
            fetchCategories(level || "A1");
          }}
          defaultLevel={level || "A1"}
        />
      )}

      <Screen className="space-y-6 p-4 pb-24">
        {isAdmin && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowAdmin(true)}
            className="w-full font-bold flex items-center justify-center gap-2 mb-2"
          >
            <ShieldAlert className="w-4 h-4" /> Додати Навчальний День
          </Button>
        )}

        <div className="relative flex items-start justify-between pt-1">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-6 -left-6 w-40 h-40 rounded-full bg-[var(--accent-cta)]/10 blur-3xl"
          />
          <div className="relative">
            <h1 className="text-[26px] leading-none font-black tracking-tight text-[var(--text-main)]">
              Навчання
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 font-medium tracking-wide uppercase">
              {completedUnits} з {totalUnits} тем пройдено
            </p>
          </div>
          <div className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-cta)]/10 border border-[var(--accent-cta)]/25 text-[var(--accent-cta)] font-black text-sm shadow-[0_2px_12px_rgba(232,163,61,0.15)]">
            <Trophy className="w-4 h-4" />
            <span className="tabular-nums">{xp}</span>
          </div>
        </div>

        <Card className="relative overflow-hidden !p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(120% 80% at 0% 0%, rgba(232,163,61,0.12) 0%, transparent 55%)",
            }}
          />
          <div className="relative flex items-center gap-4">
            <div className="shrink-0 drop-shadow-[0_0_18px_rgba(232,163,61,0.15)]">
              <DailyCookie eaten={todayCount} total={DAILY_GOAL} size={84} />
            </div>
            <div className="flex-1 min-w-0">
              {goalReached ? (
                <>
                  <div className="inline-flex items-center gap-1.5 text-emerald-400 font-black text-[13px]">
                    <PartyPopper className="w-4 h-4" />
                    Ціль виконана!
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    О 00:00 — новий набір.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1.5 text-[var(--accent-cta)] font-black text-[13px]">
                    <Flame className="w-4 h-4" />
                    Ціль на сьогодні
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    Заверши уроки у {DAILY_GOAL} категоріях
                  </p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <span className="text-xs font-black text-[var(--text-main)] tabular-nums min-w-[28px]">
                      {todayCount}/{DAILY_GOAL}
                    </span>
                    <div className="flex-1">
                      <ProgressBar
                        progress={(todayCount / DAILY_GOAL) * 100}
                        className="!h-1.5"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center text-sm text-[var(--text-muted)] py-10 animate-pulse">
            Завантаження уроків...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent-cta)]" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.12em] text-[var(--text-main)]">
                  План на сьогодні
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3" />
                    {streak} дн.
                  </span>
                )}
                <span className="text-[11px] font-bold text-[var(--text-muted)] tabular-nums">
                  {todayCount}/{DAILY_GOAL}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const completed = cat.units.filter(
                  (u) => progress[u.id]?.completed,
                ).length;
                const total = cat.units.length;
                const percent =
                  total > 0 ? Math.round((completed / total) * 100) : 0;
                const done = isCategoryDoneToday(cat);
                const isNext = !done && cat.id === nextCategoryId;

                return (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/learning/category/${cat.id}`)}
                    className={`group relative aspect-square rounded-3xl p-3.5 text-left bg-[var(--bg-card)] border overflow-hidden transition-all duration-200 active:scale-[0.97] flex flex-col ${
                      done
                        ? "border-emerald-500/25 opacity-75"
                        : isNext
                          ? `border-[var(--accent-cta)]/45 ${accentGlow[cat.accent]}`
                          : "border-[var(--border-color)] hover:border-[var(--border-color)]/80"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 ${accentTint[cat.accent]}`}
                    />
                    <div className="relative flex items-start justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${accentBadge[cat.accent]} shadow-inner`}
                      >
                        {cat.emoji}
                      </div>
                      {done ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </span>
                      ) : isNext ? (
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-md bg-[var(--accent-cta)] text-[var(--text-accent)] shadow-sm shrink-0">
                          next
                        </span>
                      ) : (
                        <span className="w-6 h-6 shrink-0" />
                      )}
                    </div>
                    <div className="relative mt-auto space-y-1.5">
                      <h3
                        className={`text-[13px] font-black leading-tight tracking-tight line-clamp-2 min-h-[2.2em] ${
                          done
                            ? "text-[var(--text-muted)] line-through"
                            : "text-[var(--text-main)]"
                        }`}
                      >
                        {cat.title}
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)] tabular-nums font-semibold">
                        {completed}/{total} юнітів
                      </p>
                      <ProgressBar
                        progress={percent}
                        className="!h-1.5"
                        accent={accentProgress[cat.accent]}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Screen>
    </>
  );
};
